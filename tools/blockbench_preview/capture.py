#!/usr/bin/env python3
"""Guarded local Blockbench editor capture; never Minecraft client acceptance."""
import argparse
import base64
import hashlib
import ipaddress
import json
import math
from pathlib import Path
import re
import struct
import time
import urllib.parse
import urllib.request

LIMIT = 32 * 1024 * 1024
TOOLS = {'get_project_info', 'create_offscreen_view', 'delete_offscreen_view',
         'set_camera_angle', 'animation_timeline', 'capture_screenshot', 'list_views'}


class Rejected(RuntimeError):
    """A bounded, public-safe error (never raw server/session content)."""


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise Rejected(message)


def endpoint(value):
    try:
        url = urllib.parse.urlsplit(value)
        address = ipaddress.ip_address(url.hostname or '')
        port = url.port
    except ValueError:
        raise Rejected('Endpoint must be a literal loopback HTTP address') from None
    require(url.scheme == 'http' and address.is_loopback and port is not None
            and not url.username and not url.password and not url.query
            and not url.fragment and url.path == '/bb-mcp',
            'Only http://<literal-loopback>:<port>/bb-mcp is allowed')
    return value


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Rejected('HTTP redirects are forbidden')


class Client:
    def __init__(self, url):
        self.url = endpoint(url)
        self.session = None
        self.protocol = None
        self.number = 0
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(self, method, params=None, notification=False):
        self.number += 1
        payload = {'jsonrpc': '2.0', 'method': method}
        if not notification:
            payload['id'] = self.number
        if params is not None:
            payload['params'] = params
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
        if self.session:
            headers['Mcp-Session-Id'] = self.session
        if self.protocol:
            headers['MCP-Protocol-Version'] = self.protocol
        try:
            req = urllib.request.Request(self.url, json.dumps(payload).encode(), headers)
            with self.opener.open(req, timeout=30) as response:
                self.session = response.headers.get('Mcp-Session-Id', self.session)
                if notification:
                    return None
                if 'text/event-stream' in response.headers.get('Content-Type', ''):
                    size, data, value = 0, [], None
                    deadline = time.monotonic() + 30
                    while True:
                        require(time.monotonic() <= deadline, 'SSE response deadline exceeded')
                        raw = response.readline(LIMIT + 1)
                        if not raw:
                            break
                        size += len(raw)
                        require(size <= LIMIT, 'MCP response exceeds size limit')
                        line = raw.decode().rstrip('\r\n')
                        if line.startswith('data:'):
                            data.append(line[5:].lstrip())
                        if not line and data:
                            item = json.loads('\n'.join(data))
                            data = []
                            if item.get('id') == payload['id']:
                                value = item
                                break
                    require(value is not None, 'No matching SSE response')
                else:
                    raw = response.read(LIMIT + 1)
                    require(len(raw) <= LIMIT, 'MCP response exceeds size limit')
                    value = json.loads(raw)
            require(value.get('jsonrpc') == '2.0' and value.get('id') == payload['id'],
                    'Mismatched JSON-RPC response')
            require('error' not in value and isinstance(value.get('result'), dict), 'MCP request failed')
            return value['result']
        except Rejected:
            raise
        except Exception:
            raise Rejected('MCP transport or response failed; no automatic retry') from None

    def initialize(self):
        result = self.request('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {},
                              'clientInfo': {'name': 'guarded-editor-preview', 'version': '1.0'}})
        self.protocol = result.get('protocolVersion')
        require(self.protocol in {'2024-11-05', '2025-03-26', '2025-06-18'}, 'Unsupported MCP protocol')
        self.request('notifications/initialized', notification=True)
        names, seen, cursor = set(), set(), None
        for _ in range(20):
            result = self.request('tools/list', {'cursor': cursor} if cursor else {})
            names.update(tool['name'] for tool in result.get('tools', []))
            cursor = result.get('nextCursor')
            if not cursor:
                break
            require(cursor not in seen, 'Repeated tool-list cursor')
            seen.add(cursor)
        else:
            raise Rejected('Too many tool-list pages')
        require('risky_eval' not in names, 'Unsafe eval tool exposed; harden plugin first')
        require(TOOLS <= names, 'Required typed preview tools unavailable')

    def tool(self, name, arguments):
        require(name in TOOLS, 'Tool is outside capture allowlist')
        result = self.request('tools/call', {'name': name, 'arguments': arguments})
        require(not result.get('isError'), 'Typed tool reported failure')
        return result

    def snapshot(self, expected_name, expected_uuid=None):
        info = self.tool('get_project_info', {})
        data = info.get('structuredContent')
        if not isinstance(data, dict):
            try:
                data = json.loads(next(x['text'] for x in info.get('content', []) if x.get('type') == 'text'))
            except Exception:
                raise Rejected('Project information unavailable') from None
        project = data.get('project', {})
        require(project.get('name') == expected_name, 'Active project name mismatch')
        uuid = project.get('uuid')
        require(isinstance(uuid, str) and re.fullmatch(r'[a-fA-F0-9-]{36}', uuid), 'Project UUID unavailable')
        require(expected_uuid is None or uuid == expected_uuid, 'Active project UUID changed')
        uri = 'blockbench://project/' + uuid + '.bbmodel'
        links = [x for x in info.get('content', []) if x.get('type') == 'resource_link' and x.get('uri') == uri]
        require(len(links) == 1, 'Exact live project resource unavailable')
        result = self.request('resources/read', {'uri': uri})
        parts = result.get('contents', [])
        require(len(parts) == 1 and parts[0].get('uri') == uri and isinstance(parts[0].get('text'), str),
                'Unexpected live project resource')
        raw = parts[0]['text'].encode('utf-8')
        try:
            model = json.loads(raw)
        except Exception:
            raise Rejected('Invalid live project JSON') from None
        require(model.get('name') == expected_name, 'Live export name mismatch')
        return uuid, raw, model


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def validate(plan):
    require(isinstance(plan, dict) and set(plan) - {'view_mode'} == {'schema', 'project_name', 'fixture_sha256',
            'live_sha256', 'primary_animation', 'camera', 'times', 'context'}, 'Unexpected plan fields')
    require(plan['schema'] == 1, 'Unsupported plan version')
    require(plan.get('view_mode', 'offscreen') in {'active', 'offscreen'}, 'Invalid view mode')
    for key in ('fixture_sha256', 'live_sha256'):
        require(isinstance(plan[key], str) and re.fullmatch('[a-f0-9]{64}', plan[key]), 'Invalid SHA256 pin')
    for key in ('project_name', 'primary_animation'):
        require(isinstance(plan[key], str) and 0 < len(plan[key]) <= 160
                and not any(c in plan[key] for c in '/\\\r\n'), 'Invalid project/animation name')
    camera = plan['camera']
    require(isinstance(camera, dict) and set(camera) == {'position', 'target', 'fov', 'width', 'height'},
            'Camera requires position, target, fov, width and height')
    for key in ('position', 'target'):
        require(isinstance(camera[key], list) and len(camera[key]) == 3 and all(number(v) for v in camera[key]),
                'Camera vector must have three finite numbers')
    require(camera['position'] != camera['target'], 'Camera position equals target')
    require(number(camera['fov']) and 1 <= camera['fov'] <= 179, 'Invalid FOV')
    for key in ('width', 'height'):
        require(type(camera[key]) is int and 16 <= camera[key] <= 2048, 'Invalid capture dimensions')
    require(isinstance(plan['times'], list) and 0 < len(plan['times']) <= 100
            and all(number(t) and 0 <= t <= 10000 for t in plan['times']), 'Invalid sample times')
    context = plan['context']
    require(isinstance(context, dict) and set(context) == {'blockbench_version', 'source_revision',
            'mode', 'hand', 'playing_order', 'preview_only_changes', 'runtime_limits'}, 'Missing evidence context')
    require(context['mode'] in {'attachable_first', 'attachable_third'}, 'Invalid Bedrock preview mode')
    require(context['hand'] in {'main', 'offhand'}, 'Invalid hand')
    for key in ('blockbench_version', 'source_revision', 'runtime_limits'):
        require(isinstance(context[key], str) and 0 < len(context[key]) <= 2000, 'Missing context description')
    require(isinstance(context['preview_only_changes'], list) and all(isinstance(x, str) for x in context['preview_only_changes']),
            'Preview changes must be explicitly listed')
    clips = context['playing_order']
    require(isinstance(clips, list) and 0 < len(clips) <= 20, 'Playing order required')
    for clip in clips:
        require(isinstance(clip, dict) and set(clip) == {'name', 'scope', 'override', 'playing'}, 'Invalid clip declaration')
        require(isinstance(clip['name'], str) and type(clip['scope']) is int and clip['scope'] > 0
                and type(clip['override']) is bool, 'Invalid clip metadata')
        require(clip['playing'] == ('primary' if clip['name'] == plan['primary_animation'] else 'locked'),
                'Secondary clips must be declared locked')
    require(len({c['name'] for c in clips}) == len(clips) and
            sum(c['name'] == plan['primary_animation'] for c in clips) == 1, 'Primary must occur exactly once')


def check_model(model, plan):
    require(model.get('multi_file_ruleset') == 'bedrock_attachable', 'Native scoped ruleset missing')
    require(model.get('bedrock_animation_mode') == plan['context']['mode'], 'Bedrock mode mismatch')
    animations = model.get('animations', [])
    selected = [a.get('name') for a in animations if a.get('selected')]
    require(selected == [plan['primary_animation']], 'Select the declared primary clip before capture')
    for clip in plan['context']['playing_order']:
        matches = [a for a in animations if a.get('name') == clip['name']]
        require(len(matches) == 1 and matches[0].get('scope') == clip['scope']
                and matches[0].get('override', False) == clip['override'], 'Clip scope/Override mismatch')


def read_views(client):
    result = client.tool('list_views', {})
    data = result.get('structuredContent')
    if not isinstance(data, dict):
        try:
            data = json.loads(next(x['text'] for x in result.get('content', []) if x.get('type') == 'text'))
        except Exception:
            raise Rejected('View metadata unavailable') from None
    require(isinstance(data.get('views'), list), 'View list unavailable')
    return data['views']


def active_view(client, camera, expected_id=None):
    matches = [v for v in read_views(client) if v.get('kind') == 'viewport' and v.get('active') is True]
    require(len(matches) == 1, 'Exactly one active native viewport required')
    view = matches[0]
    require(isinstance(view.get('id'), str) and view['id'] and
            (expected_id is None or view['id'] == expected_id), 'Active viewport changed')
    require(view.get('width') == camera['width'] and view.get('height') == camera['height'],
            'Native viewport dimensions differ from plan; resize manually before capture')
    actual = view.get('camera', {})
    require(actual.get('projection') == 'perspective' and actual.get('locked_angle') is None,
            'Native viewport projection/lock mismatch')
    # The plugin reports camera metadata rounded to three decimals.
    for key in ('position', 'target'):
        values = actual.get(key)
        require(isinstance(values, list) and len(values) == 3 and
                all(number(a) and abs(a - b) <= .001 for a, b in zip(values, camera[key])),
                'Native viewport camera differs from plan')
    require(number(actual.get('fov')) and abs(actual['fov'] - camera['fov']) <= .001,
            'Native viewport FOV differs from plan')
    return view


def run(url, fixture, output, plan=None, inspect_name=None):
    """Capture after reviewed pins, or read-only inspect to obtain a live-export pin."""
    endpoint(url)
    fixture_bytes = fixture.read_bytes()
    if plan is not None:
        validate(plan)
        require(sha(fixture_bytes) == plan['fixture_sha256'], 'Source fixture SHA256 mismatch')
    require(not output.exists(), 'Output must be a new directory')
    output.mkdir(mode=0o700, parents=True)
    receipt = {'schema': 1, 'status': 'incomplete', 'scope': 'Blockbench editor preview only; client=false',
               'fixture_sha256': sha(fixture_bytes), 'steps': [], 'frames': [],
               'playing_state': 'operator-declared; bbmodel does not serialize playing/locked flags'}
    if plan is not None:
        receipt['plan'] = plan
    def save():
        (output / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    client, view_created = Client(url), False
    try:
        client.initialize()
        name = plan['project_name'] if plan else inspect_name
        uuid, raw, model = client.snapshot(name)
        if plan is not None:
            require(sha(raw) == plan['live_sha256'], 'Initial live export SHA256 mismatch')
            check_model(model, plan)
        (output / 'initial-live.bbmodel').write_bytes(raw)
        receipt['live_sha256'] = sha(raw)
        if plan is None:
            receipt['observed_views'] = read_views(client)
            receipt['status'] = 'inspected_only'
            return receipt
        use_active = plan.get('view_mode', 'offscreen') == 'active'
        camera = plan['camera']
        view = active_view(client, camera)['id'] if use_active else 'qa_' + plan['live_sha256'][:16]
        receipt['view_mode'] = 'active' if use_active else 'offscreen'
        receipt['view_id'] = view
        def guard():
            require(sha(fixture.read_bytes()) == plan['fixture_sha256'], 'Source fixture changed during capture')
            _, current, current_model = client.snapshot(name, uuid)
            require(sha(current) == plan['live_sha256'], 'Live project changed during capture')
            check_model(current_model, plan)
            if use_active:
                receipt['verified_view'] = active_view(client, camera, view)
        def call(tool, args):
            nonlocal view_created
            guard()
            result = client.tool(tool, args)
            if tool == 'create_offscreen_view':
                view_created = True
            guard()
            receipt['steps'].append({'tool': tool, 'arguments': args, 'guard': 'before_and_after_passed'})
            save()
            return result
        # Active mode verifies the existing camera and never creates, moves or resizes a view.
        if not use_active:
            call('create_offscreen_view', {'id': view, 'width': camera['width'], 'height': camera['height'], 'copy_view': 'none'})
            call('set_camera_angle', {'view': view, 'position': camera['position'], 'target': camera['target'],
                                     'projection': 'perspective', 'fov': camera['fov'], 'format': 'png'})
        else:
            receipt['cleanup'] = 'not_needed; native viewport retained unchanged'
        call('animation_timeline', {'animation_id': plan['primary_animation'], 'action': 'pause'})
        for index, time in enumerate(plan['times']):
            call('animation_timeline', {'animation_id': plan['primary_animation'], 'action': 'set_time', 'time': time})
            result = call('capture_screenshot', {'project': uuid, 'view': view, 'format': 'png'})
            images = [x for x in result.get('content', []) if x.get('type') == 'image']
            require(len(images) == 1 and images[0].get('mimeType') == 'image/png', 'Expected exactly one PNG')
            try:
                image = base64.b64decode(images[0]['data'], validate=True)
            except Exception:
                raise Rejected('Invalid PNG encoding') from None
            require(len(image) >= 24 and image.startswith(b'\x89PNG\r\n\x1a\n')
                    and image[12:16] == b'IHDR', 'Invalid PNG header')
            image_width, image_height = struct.unpack('>II', image[16:24])
            require(0 < image_width <= 8192 and 0 < image_height <= 8192, 'Invalid PNG dimensions')
            filename = f'frame-{index:04d}.png'
            (output / filename).write_bytes(image)
            receipt['frames'].append({'file': filename, 'time_seconds': time, 'sha256': sha(image),
                                      'png_width': image_width, 'png_height': image_height})
            save()
        guard()
        receipt['status'] = 'captured_editor_only'
        return receipt
    except Exception as error:
        receipt['status'] = 'failed'
        receipt['failure'] = str(error) if isinstance(error, Rejected) else 'Unexpected local failure'
        raise
    finally:
        if view_created:
            try:
                client.tool('delete_offscreen_view', {'view': view})
                receipt['cleanup'] = 'offscreen_view_deleted'
            except Exception:
                receipt['cleanup'] = 'failed; disposal incomplete or unverified; do not repeat offscreen capture'
                if receipt['status'] == 'captured_editor_only':
                    receipt['status'] = 'captured_editor_cleanup_failed'
        save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--endpoint', default='http://127.0.0.1:3000/bb-mcp')
    parser.add_argument('--fixture', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--plan', type=Path)
    mode.add_argument('--inspect-project', help='Read-only snapshot; independently review before pinning in a plan')
    args = parser.parse_args()
    try:
        plan = json.loads(args.plan.read_text()) if args.plan else None
        receipt = run(args.endpoint, args.fixture, args.output, plan, args.inspect_project)
        print(json.dumps({'status': receipt['status'], 'fixture_sha256': receipt['fixture_sha256'],
                          'live_sha256': receipt['live_sha256'], 'frames': len(receipt['frames']),
                          'cleanup': receipt.get('cleanup', 'not_needed')}))
        if receipt['status'] == 'captured_editor_cleanup_failed':
            parser.exit(2, 'Capture frames retained, but offscreen cleanup failed; stop offscreen capture\n')
    except Exception as error:
        parser.exit(1, (str(error) if isinstance(error, Rejected) else 'Local input or capture failure') + '\n')


if __name__ == '__main__':
    main()
