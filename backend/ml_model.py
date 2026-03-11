import os
import subprocess
import sys


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    infer_path = os.path.join(script_dir, "ml", "infer.py")
    cmd = [sys.executable, infer_path] + sys.argv[1:]
    completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if completed.stdout:
        print(completed.stdout.strip())
    if completed.stderr:
        print(completed.stderr.strip(), file=sys.stderr)
    sys.exit(completed.returncode)


if __name__ == "__main__":
    main()
