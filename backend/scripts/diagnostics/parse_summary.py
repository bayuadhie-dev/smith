import docx2txt
text = docx2txt.process("/home/superadmin/Downloads/ringkasan QP WI DCC.docx")
lines = text.split('\n')
for i, line in enumerate(lines):
    if len(line.strip()) > 0:
        print(f"{i}: {line}")
