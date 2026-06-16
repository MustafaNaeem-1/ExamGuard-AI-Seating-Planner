import customtkinter as ctk
import tkinter.ttk as ttk
from tkinter import messagebox
import csv
from data_generator import generate_student_data

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class ConfigUI(ctk.CTk):
    def __init__(self, on_start_callback):
        super().__init__()
        self.on_start_callback = on_start_callback
        
        self.title("Exam Hall Setup Dashboard")
        self.geometry("900x650")
        
        self.grid_columnconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=2)
        self.grid_rowconfigure(0, weight=1)
        
        # Left Panel - Settings
        self.settings_frame = ctk.CTkFrame(self, corner_radius=10)
        self.settings_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        
        ctk.CTkLabel(self.settings_frame, text="Hall Setup", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=(15, 10))
        
        # Dimensions
        dim_frame = ctk.CTkFrame(self.settings_frame, fg_color="transparent")
        dim_frame.pack(fill="x", padx=10, pady=5)
        
        ctk.CTkLabel(dim_frame, text="Rows:").grid(row=0, column=0, sticky="w", padx=5)
        self.rows_var = ctk.StringVar(value="10")
        ctk.CTkEntry(dim_frame, textvariable=self.rows_var, width=60).grid(row=0, column=1, padx=5)
        
        ctk.CTkLabel(dim_frame, text="Cols:").grid(row=0, column=2, sticky="w", padx=5)
        self.cols_var = ctk.StringVar(value="10")
        ctk.CTkEntry(dim_frame, textvariable=self.cols_var, width=60).grid(row=0, column=3, padx=5)
        
        ctk.CTkLabel(self.settings_frame, text="Generator Settings", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=(20, 10))
        
        # Subjects
        ctk.CTkLabel(self.settings_frame, text="Subjects (comma separated):").pack(anchor="w", padx=15)
        self.subjects_var = ctk.StringVar(value="Math, Physics, Chemistry")
        ctk.CTkEntry(self.settings_frame, textvariable=self.subjects_var).pack(fill="x", padx=15, pady=(0, 10))
        
        # Students
        ctk.CTkLabel(self.settings_frame, text="Number of Students:").pack(anchor="w", padx=15)
        self.students_var = ctk.StringVar(value="100")
        ctk.CTkEntry(self.settings_frame, textvariable=self.students_var).pack(fill="x", padx=15, pady=(0, 10))
        
        # High Risk %
        self.risk_label = ctk.CTkLabel(self.settings_frame, text="High Risk (%): 20%")
        self.risk_label.pack(anchor="w", padx=15)
        self.risk_var = ctk.IntVar(value=20)
        def update_risk_label(val):
            self.risk_label.configure(text=f"High Risk (%): {int(val)}%")
        ctk.CTkSlider(self.settings_frame, from_=0, to=100, variable=self.risk_var, command=update_risk_label).pack(fill="x", padx=15, pady=(0, 10))
        
        # Friend Groups
        ctk.CTkLabel(self.settings_frame, text="Number of Friend Groups:").pack(anchor="w", padx=15)
        self.friends_var = ctk.StringVar(value="20")
        ctk.CTkEntry(self.settings_frame, textvariable=self.friends_var).pack(fill="x", padx=15, pady=(0, 20))
        
        ctk.CTkButton(self.settings_frame, text="Generate Random Data", command=self.generate_data).pack(fill="x", padx=15, pady=5)
        
        # Manual Add Frame
        add_frame = ctk.CTkFrame(self.settings_frame)
        add_frame.pack(fill="x", padx=10, pady=20)
        ctk.CTkLabel(add_frame, text="Quick Add Student", font=ctk.CTkFont(size=14, weight="bold")).pack(pady=5)
        
        form_frame = ctk.CTkFrame(add_frame, fg_color="transparent")
        form_frame.pack(fill="x", padx=5, pady=5)
        
        self.add_name = ctk.CTkEntry(form_frame, placeholder_text="Name", width=100)
        self.add_name.grid(row=0, column=0, padx=2, pady=2)
        self.add_subj = ctk.CTkEntry(form_frame, placeholder_text="Subject", width=80)
        self.add_subj.grid(row=0, column=1, padx=2, pady=2)
        self.add_friend = ctk.CTkEntry(form_frame, placeholder_text="Friend Grp (num)", width=100)
        self.add_friend.grid(row=1, column=0, padx=2, pady=2)
        self.add_risk = ctk.CTkEntry(form_frame, placeholder_text="Risk (1-10)", width=80)
        self.add_risk.grid(row=1, column=1, padx=2, pady=2)
        
        ctk.CTkButton(add_frame, text="Add Student", width=100, command=self.add_student).pack(pady=5)
        
        # Right Panel - Data View & Optimize
        self.data_frame = ctk.CTkFrame(self, corner_radius=10)
        self.data_frame.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")
        
        top_bar = ctk.CTkFrame(self.data_frame, fg_color="transparent")
        top_bar.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(top_bar, text="Student Data Preview", font=ctk.CTkFont(size=18, weight="bold")).pack(side="left")
        ctk.CTkButton(top_bar, text="Load from CSV", width=120, command=self.load_csv).pack(side="right", padx=5)
        
        # Treeview for Table
        style = ttk.Style()
        style.theme_use("default")
        style.configure("Treeview", background="#2a2d2e", foreground="white", rowheight=25, fieldbackground="#343638", bordercolor="#343638", borderwidth=0)
        style.map("Treeview", background=[('selected', '#22559b')])
        style.configure("Treeview.Heading", background="#565b5e", foreground="white", relief="flat")
        
        tree_frame = ctk.CTkFrame(self.data_frame)
        tree_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        columns = ("ID", "Name", "Subject", "FriendGroup", "Risk")
        self.tree = ttk.Treeview(tree_frame, columns=columns, show="headings")
        for col in columns:
            self.tree.heading(col, text=col)
            self.tree.column(col, width=80, anchor="center")
        
        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Action Bar
        action_bar = ctk.CTkFrame(self.data_frame, fg_color="transparent")
        action_bar.pack(fill="x", padx=10, pady=10)
        
        self.total_lbl = ctk.CTkLabel(action_bar, text="Total: 0 students")
        self.total_lbl.pack(side="left")
        
        ctk.CTkButton(action_bar, text="RUN OPTIMIZATION", font=ctk.CTkFont(weight="bold", size=16), fg_color="#2E8B57", hover_color="#3CB371", height=40, command=self.start_optimization).pack(side="right")
        
        self.students = []
        self.load_csv() # Load initially if exists
        
    def refresh_table(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        for s in self.students:
            self.tree.insert("", "end", values=(s.get("StudentID", ""), s.get("Name", ""), s.get("Subject", ""), s.get("FriendGroupID", ""), s.get("CheatingRiskScore", "")))
        self.total_lbl.configure(text=f"Total: {len(self.students)} students")
        
    def load_csv(self):
        try:
            with open("students.csv", mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                self.students = list(reader)
            self.refresh_table()
        except FileNotFoundError:
            self.students = []
            
    def save_csv(self):
        with open("students.csv", mode='w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=["StudentID", "Name", "Subject", "FriendGroupID", "CheatingRiskScore"])
            writer.writeheader()
            writer.writerows(self.students)

    def generate_data(self):
        try:
            num = int(self.students_var.get())
            risk = int(self.risk_var.get())
            friends = int(self.friends_var.get())
            subjects = [s.strip() for s in self.subjects_var.get().split(",") if s.strip()]
            
            generate_student_data(
                num_students=num,
                subjects=subjects,
                high_risk_percentage=risk,
                num_friend_groups=friends,
                filename="students.csv"
            )
            self.load_csv()
        except Exception as e:
            messagebox.showerror("Error", str(e))
            
    def add_student(self):
        name = self.add_name.get().strip()
        subj = self.add_subj.get().strip()
        try:
            friend = int(self.add_friend.get().strip())
            risk = int(self.add_risk.get().strip())
            if not (1 <= risk <= 10):
                raise ValueError("Risk must be between 1 and 10")
        except ValueError as e:
            messagebox.showerror("Error", f"Invalid input: {e}")
            return
            
        if not name or not subj:
            messagebox.showerror("Error", "Name and Subject required")
            return
            
        new_id = f"S{len(self.students)+1:03d}"
        self.students.append({
            "StudentID": new_id,
            "Name": name,
            "Subject": subj,
            "FriendGroupID": friend,
            "CheatingRiskScore": risk
        })
        self.save_csv()
        self.refresh_table()
        
        self.add_name.delete(0, 'end')
        self.add_subj.delete(0, 'end')
        self.add_friend.delete(0, 'end')
        self.add_risk.delete(0, 'end')

    def start_optimization(self):
        try:
            rows = int(self.rows_var.get())
            cols = int(self.cols_var.get())
            if len(self.students) > rows * cols:
                messagebox.showerror("Error", f"Grid capacity {rows*cols} is too small for {len(self.students)} students!")
                return
            
            self.save_csv()
            params = {
                "rows": rows,
                "cols": cols,
                "num_students": len(self.students),
                "generate_new": False # We already saved to CSV
            }
            self.destroy()
            self.on_start_callback(params)
        except Exception as e:
            messagebox.showerror("Error", str(e))

def show_config(on_start_callback):
    app = ConfigUI(on_start_callback)
    app.mainloop()

if __name__ == "__main__":
    def dummy(p): print(p)
    show_config(dummy)
