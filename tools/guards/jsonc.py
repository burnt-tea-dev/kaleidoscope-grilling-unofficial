"""Strip JSONC comments/trailing commas without altering JSON string values."""
import re

def strip_jsonc(text):
    pattern = re.compile(r'"(?:\\.|[^"\\])*"|//[^\r\n]*|/\*[\s\S]*?\*/')
    def remove(match):
        value = match.group()
        return value if value.startswith('"') else re.sub(r'[^\r\n]', ' ', value)
    clean = pattern.sub(remove, text)
    pattern = re.compile(r'"(?:\\.|[^"\\])*"|,(?=\s*[}\]])')
    return pattern.sub(lambda m: m.group() if m.group().startswith('"') else '', clean)
