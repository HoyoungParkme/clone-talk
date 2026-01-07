import re
import datetime

def parse_kakao_talk(file_path: str):
    messages = []
    # Pattern: "2026년 1월 1일 오전 10:00, 나 : ..."
    # Regex to capture: Date, Speaker, Message
    pattern = re.compile(r"^(\d{4}년 \d{1,2}월 \d{1,2}일 (오전|오후) \d{1,2}:\d{2}), (.*?) : (.*)$")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception:
        # Fallback to euc-kr if utf-8 fails
        with open(file_path, 'r', encoding='euc-kr') as f:
            lines = f.readlines()
        
    current_msg = None
    
    # Process last 3000 lines for efficiency in MVP
    lines_to_process = lines[-3000:] if len(lines) > 3000 else lines
    
    for line_no, line in enumerate(lines_to_process):
        line = line.strip()
        match = pattern.match(line)
        if match:
            if current_msg:
                messages.append(current_msg)
            
            # Simple timestamp normalization could happen here
            current_msg = {
                "ts": match.group(1),
                "speaker": match.group(3),
                "text": match.group(4),
                "line_no": line_no
            }
        else:
            if current_msg:
                current_msg["text"] += "\n" + line
                
    if current_msg:
        messages.append(current_msg)
        
    return messages
