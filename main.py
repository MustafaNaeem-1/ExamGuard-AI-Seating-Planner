
import subprocess
import sys
import os
    
def start_servers():
    print("Starting the Examatrix Web App...")
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    frontend_dir = os.path.join(base_dir, "frontend")
    
    if not os.path.exists(backend_dir) or not os.path.exists(frontend_dir):
      print("Error: Could not find backend or frontend directories.")
      sys.exit(1)
      
    print("Starting Python Flask Backend on port 5000...")
    #backend_process = subprocess.Popen([sys.executable, "app.py"], cwd=backend_dir)
    backend_process = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=backend_dir,
        stdout=sys.stdout,
        stderr=sys.stderr
    )

    print("Starting React Vite Frontend...")
    #"npm.cmd" if os.name == "nt" else "npm"
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    #npm_cmd = "npm"
    #frontend_process = subprocess.Popen([npm_cmd, "run", "dev"], cwd=frontend_dir)
    frontend_process = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=frontend_dir,
        stdout=sys.stdout,
        stderr=sys.stderr,
        shell=True
    )

    print("\n" + "="*50)
    print("Web Application is running!")
    print("Open your browser to: http://localhost:5173/")
    print("="*50 + "\n")
    print("Press Ctrl+C in this terminal to stop both servers.")

    try:
        while True:
            if backend_process.poll() is not None:
                print("Backend stopped.")
                break
            if frontend_process.poll() is not None:
                print("Frontend stopped.")
                break
    except KeyboardInterrupt:
        print("\nStopping servers...")
        backend_process.terminate()
        frontend_process.terminate()
        print("Servers stopped.")

if __name__ == "__main__":
    start_servers()
