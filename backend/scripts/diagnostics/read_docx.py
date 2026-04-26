import docx2txt
text = docx2txt.process("/home/superadmin/Downloads/ringkasan QP-DCC-01.docx")
print("=== QP-DCC-01 ===")
print(text)
text2 = docx2txt.process("/home/superadmin/Downloads/ringkasan QP WI DCC.docx")
print("=== ringkasan QP WI DCC ===")
print(text2)
