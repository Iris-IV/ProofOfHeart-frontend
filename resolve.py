import os, re

def get_conflicts(text):
    return re.findall(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> [^\n]*', text, re.DOTALL)

for root, _, files in os.walk('src'):
    for f in files:
        if not f.endswith(('.ts', '.tsx')): continue
        path = os.path.join(root, f)
        with open(path, 'r') as file:
            content = file.read()
        
        conflicts = get_conflicts(content)
        if conflicts:
            print(f"--- {path} ---")
            for i, (head, theirs) in enumerate(conflicts):
                print(f"Conflict {i+1}:")
                print("HEAD:")
                print(head)
                print("THEIRS:")
                print(theirs)
                print("="*40)
