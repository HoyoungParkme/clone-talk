import re
import datetime

def parse_kakao_talk(file_path: str):
    messages = []
    # Pattern 1: "2026년 1월 1일 오전 10:00, 나 : ..."
    pattern1 = re.compile(r"^(\d{4}년 \d{1,2}월 \d{1,2}일 (오전|오후) \d{1,2}:\d{2}), (.*?) : (.*)$")
    # Pattern 2: "[박호영] [오전 10:16] 임크로스핏씨"
    pattern2 = re.compile(r"^\[(.*?)\] \[(오전|오후) \d{1,2}:\d{2}\] (.*)$")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception:
        # Fallback to euc-kr if utf-8 fails
        try:
            with open(file_path, 'r', encoding='euc-kr') as f:
                lines = f.readlines()
        except:
            return [] # Empty if decoding fails
        
    current_msg = None
    
    # Process lines
    for line_no, line in enumerate(lines):
        line = line.strip()
        if not line: continue
        
        match1 = pattern1.match(line)
        match2 = pattern2.match(line)
        
        if match1:
            if current_msg: messages.append(current_msg)
            current_msg = {
                "ts": match1.group(1),
                "speaker": match1.group(3),
                "text": match1.group(4),
                "line_no": line_no
            }
        elif match2:
            if current_msg: messages.append(current_msg)
            current_msg = {
                "ts": match2.group(2), # Simplified
                "speaker": match2.group(1),
                "text": match2.group(3),
                "line_no": line_no
            }
        else:
            if current_msg:
                current_msg["text"] += "\n" + line
            # Ignore headers
                
    if current_msg:
        messages.append(current_msg)
        
    return messages
