import customtkinter as ctk
from environment import ExamHall
from models import Student

class SeatingUI(ctk.CTk):
    def __init__(self, hall: ExamHall):
        super().__init__()
        self.hall = hall
        self.title("Optimized Exam Hall Seating Plan")
        
        # Calculate window size based on grid
        cell_size = 75
        padding = 40
        width = min(1200, hall.cols * cell_size + padding)
        height = min(800, hall.rows * cell_size + 100)
        self.geometry(f"{width}x{height}")
        
        ctk.set_appearance_mode("Dark")
        
        # Top label
        ctk.CTkLabel(self, text="Final Seating Arrangement", font=ctk.CTkFont(size=24, weight="bold")).pack(pady=15)
        
        # Legend
        legend_frame = ctk.CTkFrame(self, fg_color="transparent")
        legend_frame.pack(pady=(0, 10))
        ctk.CTkLabel(legend_frame, text="Low Risk", text_color="#2E8B57", font=ctk.CTkFont(weight="bold")).pack(side="left", padx=10)
        ctk.CTkLabel(legend_frame, text="Medium Risk", text_color="#B8860B", font=ctk.CTkFont(weight="bold")).pack(side="left", padx=10)
        ctk.CTkLabel(legend_frame, text="High Risk", text_color="#8B0000", font=ctk.CTkFont(weight="bold")).pack(side="left", padx=10)
        
        # Scrollable frame for grid
        # self.grid_frame = ctk.CTkScrollableFrame(self)
        self.grid_frame = ctk.CTkScrollableFrame(self, width=1000, height=600)
        self.grid_frame.pack(fill="both", expand=True, padx=20, pady=(0, 20))
        
        self.draw_grid()
        
    def draw_grid(self):
        for r in range(self.hall.rows):
            for c in range(self.hall.cols):
                student = self.hall.get_student(r, c)
                
                # Card frame for each seat
                card = ctk.CTkFrame(self.grid_frame, width=70, height=70, corner_radius=8)
                card.grid(row=r, column=c, padx=4, pady=4)
                card.grid_propagate(False) # keep size fixed
                
                if student:
                    # Risk mapping to color
                    # 1-3: Low (Greenish), 4-6: Medium (Yellowish), 7-10: High (Reddish)
                    risk = student.cheating_risk_score
                    if risk >= 7:
                        bg_color = "#8B0000" # Dark Red
                        fg_color = "white"
                    elif risk >= 4:
                        bg_color = "#B8860B" # Dark Goldenrod
                        fg_color = "white"
                    else:
                        bg_color = "#2E8B57" # Sea Green
                        fg_color = "white"
                        
                    card.configure(fg_color=bg_color)
                    
                    lbl_id = ctk.CTkLabel(card, text=student.student_id, font=ctk.CTkFont(size=12, weight="bold"), text_color=fg_color)
                    lbl_id.place(relx=0.5, rely=0.25, anchor="center")
                    
                    lbl_subj = ctk.CTkLabel(card, text=student.subject[:3].upper(), font=ctk.CTkFont(size=11), text_color=fg_color)
                    lbl_subj.place(relx=0.5, rely=0.55, anchor="center")
                    
                    lbl_fr = ctk.CTkLabel(card, text=f"F:{student.friend_group_id} R:{risk}", font=ctk.CTkFont(size=10), text_color=fg_color)
                    lbl_fr.place(relx=0.5, rely=0.8, anchor="center")
                else:
                    card.configure(fg_color="#333333")
                    lbl = ctk.CTkLabel(card, text="EMPTY", font=ctk.CTkFont(size=10), text_color="gray")
                    lbl.place(relx=0.5, rely=0.5, anchor="center")

def display_hall(hall: ExamHall):
    app = SeatingUI(hall)
    app.mainloop()

if __name__ == "__main__":
    from models import Student
    h = ExamHall(5, 5)
    h.place_student(Student("S01", "John", "Math", 1, 9), 0, 0)
    h.place_student(Student("S02", "Jane", "Bio", 2, 2), 0, 1)
    h.place_student(Student("S03", "Bob", "Chem", 1, 5), 1, 0)
    display_hall(h)
