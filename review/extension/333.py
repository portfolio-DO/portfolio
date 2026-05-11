with open(r"C:\Users\Admin\Desktop\Nowy folder (10)\DANE\plansze_przyklad.txt") as plik:
    for linia in plik:
        line=linia.split()
        print(line)