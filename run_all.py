import subprocess
import sys
import os
import time

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("==================================================")
    print("  🚀 Launching CSV Analysis AI Agent System")
    print("==================================================")
    print("1. Backend running on: http://127.0.0.1:8000")
    print("2. Frontend running on: http://localhost:5173")
    print("==================================================")

    # Start FastAPI backend
    backend_proc = subprocess.Popen(
        [sys.executable, "run.py"],
        cwd=backend_dir
    )

    # Start Vite frontend
    frontend_proc = subprocess.Popen(
        "npm run dev",
        cwd=frontend_dir,
        shell=True
    )

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\n🛑 Stopping services...")
        backend_proc.terminate()
        frontend_proc.terminate()

if __name__ == "__main__":
    main()
