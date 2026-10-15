"""Synthetic loopback MCP tests: no Blockbench, Minecraft, or licensed assets."""
import base64
from contextlib import contextmanager
import copy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import struct
import tempfile
import threading
import unittest
import zlib

import capture

UUID = '11111111-1111-1111-1111-111111111111'
MODEL = {'name': 'synthetic', 'multi_file_ruleset': 'bedrock_attachable',
         'bedrock_animation_mode': 'attachable_first', 'animations': [
             {'name': 'primary', 'scope': 1, 'override': True, 'selected': True},
             {'name': 'secondary', 'scope': 2, 'override': False, 'selected': False}]}
RAW = json.dumps(MODEL)
URI = 'blockbench://project/' + UUID + '.bbmodel'

def png():
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\x00\x00\x00\x00\xff')) + chunk(b'IEND', b'')


def plan():
    return {'schema': 1, 'project_name': 'synthetic', 'fixture_sha256': capture.sha(b'fixture'),
            'live_sha256': capture.sha(RAW.encode()), 'primary_animation': 'primary',
            'camera': {'position': [0, 27.41, 0], 'target': [0, 27.41, 10], 'fov': 70.25, 'width': 160, 'height': 90},
            'times': [0, .5, 1], 'context': {'blockbench_version': '5.2.2', 'source_revision': 'synthetic-test',
                'mode': 'attachable_first', 'hand': 'main', 'playing_order': [
                    {'name': 'secondary', 'scope': 2, 'override': False, 'playing': 'locked'},
                    {'name': 'primary', 'scope': 1, 'override': True, 'playing': 'primary'}],
                'preview_only_changes': [], 'runtime_limits': 'Synthetic test, no engine or editor evidence'}}


@contextmanager
def server(**faults):
    calls = []
    state = {'changed': False}
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass
        def do_POST(self):
            request = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            calls.append(request)
            if faults.get('redirect'):
                self.send_response(302)
                self.send_header('Location', 'http://example.invalid/steal')
                self.end_headers()
                return
            method, params = request['method'], request.get('params', {})
            if method == 'notifications/initialized':
                self.send_response(202)
                self.end_headers()
                return
            if method == 'initialize':
                result = {'protocolVersion': '2024-11-05'}
            elif method == 'tools/list':
                names = capture.TOOLS | ({'risky_eval'} if faults.get('unsafe') else set())
                result = {'tools': [{'name': name} for name in names]}
            elif method == 'resources/read':
                result = {'contents': [{'uri': URI, 'text': RAW + (' ' if state['changed'] else '')}]}
            elif method == 'tools/call':
                tool = params['name']
                if tool == 'get_project_info':
                    result = {'structuredContent': {'project': {'name': 'wrong' if faults.get('name') else 'synthetic', 'uuid': UUID}},
                              'content': [{'type': 'resource_link', 'uri': 'file:///private' if faults.get('resource') else URI}]}
                elif tool == 'capture_screenshot':
                    if faults.get('switch_on_capture'):
                        state['changed'] = True
                    result = {'content': [{'type': 'image', 'mimeType': 'image/png', 'data': base64.b64encode(png()).decode()}]}
                    if faults.get('tool_error'):
                        result = {'isError': True, 'content': [{'type': 'text', 'text': 'private-server-secret'}]}
                else:
                    result = {'isError': True} if tool == 'delete_offscreen_view' and faults.get('cleanup_error') else {'content': []}
                    if tool == 'create_offscreen_view' and faults.get('switch_on_create'):
                        state['changed'] = True
            else:
                raise AssertionError(method)
            response = {'jsonrpc': '2.0', 'id': request['id'] + (1 if faults.get('wrong_id') else 0), 'result': result}
            payload = json.dumps(response).encode()
            if faults.get('sse'):
                payload = b'data: ' + payload + b'\n\n'
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream' if faults.get('sse') else 'application/json')
            self.send_header('Mcp-Session-Id', 'private-session-secret')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
    instance = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=instance.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{instance.server_port}/bb-mcp', calls
    finally:
        instance.shutdown()
        instance.server_close()
        thread.join()


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.fixture = self.root / 'fixture.bbmodel'
        self.fixture.write_bytes(b'fixture')
        self.output = self.root / 'output'

    def tool_names(self, calls):
        return [r['params']['name'] for r in calls if r['method'] == 'tools/call']

    def test_json_and_sse_capture_with_guarded_receipt(self):
        for sse in (False, True):
            output = self.root / str(sse)
            with server(sse=sse) as (url, calls):
                receipt = capture.run(url, self.fixture, output, plan())
            self.assertEqual(receipt['status'], 'captured_editor_only')
            self.assertEqual([f['time_seconds'] for f in receipt['frames']], [0, .5, 1])
            self.assertEqual((output / 'initial-live.bbmodel').read_text(), RAW)
            self.assertEqual(self.tool_names(calls)[-1], 'delete_offscreen_view')
            self.assertNotIn('private-session-secret', (output / 'receipt.json').read_text())
            for frame in receipt['frames']:
                self.assertEqual(frame['sha256'], capture.sha((output / frame['file']).read_bytes()))

    def test_wrong_project_rejected_before_any_mutation(self):
        with server(name=True) as (url, calls):
            with self.assertRaisesRegex(capture.Rejected, 'name mismatch'):
                capture.run(url, self.fixture, self.output, plan())
        self.assertEqual(self.tool_names(calls), ['get_project_info'])
        self.assertFalse(list(self.output.glob('*.png')))

    def test_fixture_pin_precedes_network(self):
        p = plan(); p['fixture_sha256'] = '0' * 64
        with server() as (url, calls):
            with self.assertRaisesRegex(capture.Rejected, 'fixture SHA256'):
                capture.run(url, self.fixture, self.output, p)
        self.assertEqual(calls, [])

    def test_live_pin_precedes_mutation(self):
        p = plan(); p['live_sha256'] = '0' * 64
        with server() as (url, calls):
            with self.assertRaisesRegex(capture.Rejected, 'live export SHA256'):
                capture.run(url, self.fixture, self.output, p)
        self.assertEqual(self.tool_names(calls), ['get_project_info'])

    def test_untrusted_resource_link_is_not_followed(self):
        with server(resource=True) as (url, calls):
            with self.assertRaisesRegex(capture.Rejected, 'resource unavailable'):
                capture.run(url, self.fixture, self.output, plan())
        self.assertNotIn('resources/read', [r['method'] for r in calls])

    def test_project_drift_discards_frame_and_cleans_own_view(self):
        for fault in ('switch_on_create', 'switch_on_capture'):
            output = self.root / fault
            with server(**{fault: True}) as (url, calls):
                with self.assertRaisesRegex(capture.Rejected, 'Live project changed'):
                    capture.run(url, self.fixture, output, plan())
            receipt = json.loads((output / 'receipt.json').read_text())
            self.assertEqual(receipt['status'], 'failed')
            self.assertFalse(list(output.glob('*.png')))
            self.assertEqual(self.tool_names(calls)[-1], 'delete_offscreen_view')

    def test_endpoint_and_redirect_guards(self):
        for url in ('https://127.0.0.1:3000/bb-mcp', 'http://localhost:3000/bb-mcp',
                    'http://example.com:3000/bb-mcp', 'http://127.0.0.1:3000/bb-mcp?q=secret',
                    'http://user:pass@127.0.0.1:3000/bb-mcp', 'http://127.0.0.1:3000/other'):
            with self.assertRaises(capture.Rejected):
                capture.Client(url)
        with server(redirect=True) as (url, calls):
            with self.assertRaisesRegex(capture.Rejected, 'redirects'):
                capture.run(url, self.fixture, self.output, plan())
        self.assertEqual(len(calls), 1)

    def test_eval_exposure_rejected(self):
        with server(unsafe=True) as (url, calls):
            with self.assertRaisesRegex(capture.Rejected, 'Unsafe eval'):
                capture.run(url, self.fixture, self.output, plan())
        self.assertEqual(self.tool_names(calls), [])

    def test_tool_failure_has_no_raw_server_or_session_details(self):
        with server(tool_error=True) as (url, calls):
            with self.assertRaisesRegex(capture.Rejected, 'tool reported failure'):
                capture.run(url, self.fixture, self.output, plan())
        text = (self.output / 'receipt.json').read_text()
        self.assertNotIn('private-server-secret', text)
        self.assertNotIn('private-session-secret', text)
        self.assertEqual(json.loads(text)['status'], 'failed')

    def test_wrong_jsonrpc_id_rejected(self):
        with server(wrong_id=True) as (url, calls):
            with self.assertRaisesRegex(capture.Rejected, 'Mismatched JSON-RPC'):
                capture.run(url, self.fixture, self.output, plan())

    def test_inspect_is_read_only_and_does_not_accept_capture(self):
        with server() as (url, calls):
            receipt = capture.run(url, self.fixture, self.output, inspect_name='synthetic')
        self.assertEqual(receipt['status'], 'inspected_only')
        self.assertEqual(self.tool_names(calls), ['get_project_info'])

    def test_unknown_plan_fields_and_clip_mismatch_rejected(self):
        p = plan(); p['tools'] = [{'tool': 'risky_eval'}]
        with self.assertRaises(capture.Rejected):
            capture.validate(p)
        p = plan(); p['camera']['fov'] = float('nan')
        with self.assertRaises(capture.Rejected):
            capture.validate(p)
        p = plan(); p['context']['playing_order'][0]['scope'] = 9
        with self.assertRaisesRegex(capture.Rejected, 'scope/Override'):
            capture.check_model(MODEL, p)
        model = copy.deepcopy(MODEL); model['animations'][0]['selected'] = False
        with self.assertRaisesRegex(capture.Rejected, 'primary clip'):
            capture.check_model(model, plan())

    def test_cleanup_failure_is_a_distinct_incomplete_status(self):
        with server(cleanup_error=True) as (url, calls):
            receipt = capture.run(url, self.fixture, self.output, plan())
        self.assertEqual(receipt['status'], 'captured_editor_cleanup_failed')
        self.assertEqual(len(receipt['frames']), 3)
        self.assertIn('failed', receipt['cleanup'])
        self.assertEqual(json.loads((self.output / 'receipt.json').read_text())['status'], receipt['status'])

    def test_refuse_existing_output(self):
        self.output.mkdir()
        with server() as (url, calls):
            with self.assertRaisesRegex(capture.Rejected, 'new directory'):
                capture.run(url, self.fixture, self.output, plan())
        self.assertEqual(calls, [])


if __name__ == '__main__':
    unittest.main()
