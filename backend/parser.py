"""
모듈명: backend.parser
설명: 카카오톡 대화 내보내기 파일 파싱

주요 기능:
- 카카오톡 텍스트 포맷 파싱
- 날짜/시간/화자/메시지 추출

의존성:
- 표준 라이브러리만 사용
"""

# 1. 표준 라이브러리
import re
from pathlib import Path
from typing import List, Dict, Optional

DATE_HEADER_PATTERN = re.compile(
    r"^-+\s+(?P<date>\d{4}년\s+\d{1,2}월\s+\d{1,2}일)\s+.+\s+-+$"
)
BRACKET_PATTERN = re.compile(
    r"^\[(?P<speaker>.+?)\]\s+\[(?P<ampm>오전|오후)\s+(?P<time>\d{1,2}:\d{2})\]\s+(?P<text>.*)$"
)
COMMA_PATTERN = re.compile(
    r"^(?P<date>\d{4}[./년 ]\s?\d{1,2}[./월 ]\s?\d{1,2}일?)\s+"
    r"(?P<ampm>오전|오후)\s+(?P<time>\d{1,2}:\d{2}),\s*"
    r"(?P<speaker>[^:]+?)\s*:\s*(?P<text>.*)$"
)

def _read_lines(file_path: str) -> List[str]:
    """
    여러 인코딩을 시도해 파일 내용을 읽습니다.

    Args:
        file_path: 대상 파일 경로

    Returns:
        List[str]: 파일 라인 목록
    """
    encodings = ["utf-8-sig", "utf-8", "cp949", "euc-kr"]
    for encoding in encodings:
        try:
            return Path(file_path).read_text(encoding=encoding).splitlines()
        except UnicodeDecodeError:
            continue
        except OSError:
            return []
    return []

def _build_timestamp(current_date: Optional[str], ampm: str, time: str) -> str:
    """
    날짜와 시간 정보를 결합해 타임스탬프를 구성합니다.

    Args:
        current_date: 현재 날짜 문자열
        ampm: 오전/오후 정보
        time: 시각 정보

    Returns:
        str: 결합된 타임스탬프
    """
    if current_date:
        return f"{current_date} {ampm} {time}"
    return f"{ampm} {time}"

def parse_kakao_talk(file_path: str) -> List[Dict]:
    """
    카카오톡 대화 텍스트 파일을 파싱합니다.

    Args:
        file_path: 대화 내보내기 파일 경로

    Returns:
        List[Dict]: 메시지 목록(타임스탬프/화자/본문 포함)
    """
    messages: List[Dict] = []
    lines = _read_lines(file_path)
    current_msg: Optional[Dict] = None
    current_date: Optional[str] = None

    for line_no, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            continue

        if line.endswith("카카오톡 대화") or line.startswith("저장한 날짜"):
            continue

        date_header_match = DATE_HEADER_PATTERN.match(line)
        if date_header_match:
            current_date = date_header_match.group("date")
            continue

        bracket_match = BRACKET_PATTERN.match(line)
        if bracket_match:
            if current_msg:
                messages.append(current_msg)
            ts = _build_timestamp(
                current_date,
                bracket_match.group("ampm"),
                bracket_match.group("time"),
            )
            current_msg = {
                "ts": ts,
                "speaker": bracket_match.group("speaker"),
                "text": bracket_match.group("text"),
                "line_no": line_no,
            }
            continue

        comma_match = COMMA_PATTERN.match(line)
        if comma_match:
            if current_msg:
                messages.append(current_msg)
            ts = _build_timestamp(
                comma_match.group("date"),
                comma_match.group("ampm"),
                comma_match.group("time"),
            )
            current_msg = {
                "ts": ts,
                "speaker": comma_match.group("speaker"),
                "text": comma_match.group("text"),
                "line_no": line_no,
            }
            continue

        if current_msg:
            current_msg["text"] += "\n" + line

    if current_msg:
        messages.append(current_msg)

    return messages
