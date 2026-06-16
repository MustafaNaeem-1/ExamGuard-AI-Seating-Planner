import random
from typing import List, Tuple
from environment import ExamHall
from models import Student

class SeatingPlanner:
    def __init__(self, hall: ExamHall, students: List[Student]):
        self.hall = hall
        self.students = students
        if len(self.students) > self.hall.get_capacity():
            raise ValueError("Too many students for the hall capacity")

    def place_randomly(self):
        self.hall.clear()
        positions = [(r, c) for r in range(self.hall.rows) for c in range(self.hall.cols)]
        random.shuffle(positions)
        
        for i, student in enumerate(self.students):
            r, c = positions[i]
            self.hall.place_student(student, r, c)

    def calculate_penalty(self) -> int:
        penalty = 0
        corners = [
            (0, 0), (0, self.hall.cols - 1), 
            (self.hall.rows - 1, 0), (self.hall.rows - 1, self.hall.cols - 1)
        ]
        
        for r in range(self.hall.rows):
            for c in range(self.hall.cols):
                student = self.hall.get_student(r, c)
                if student is None: continue
                
                # High risk corner penalty (strongly discouraged)
                if student.cheating_risk_score >= 7:
                    if (r, c) in corners: penalty += 100
                    if r == 0: penalty -= 10 # Slight preference for front row if not corner
                
                # Physical Proximity Rules
                for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]: # Direct Neighbors
                    adj = self.hall.get_student(r + dr, c + dc)
                    if adj:
                        is_friend = adj.student_id in student.friends or student.student_id in adj.friends
                        # Risk: Same Subject AND Friends (Priority #1)
                        if student.subject == adj.subject and is_friend:
                            penalty += 100
                        # Risk: Just Friends (Priority #2)
                        elif is_friend:
                            penalty += 40
                        # Adjacent High Risk = Moderate Penalty
                        if student.cheating_risk_score >= 7 and adj.cheating_risk_score >= 7:
                            penalty += 30
                
                for dr, dc in [(-1, -1), (-1, 1), (1, -1), (1, 1)]: # Diagonal Neighbors
                    adj = self.hall.get_student(r + dr, c + dc)
                    if adj:
                        is_friend = adj.student_id in student.friends or student.student_id in adj.friends
                        # Diagonal Risk: Same Subject AND Friends
                        if student.subject == adj.subject and is_friend:
                            penalty += 50
                        # Diagonal Risk: Just Friends
                        elif is_friend:
                            penalty += 15
        return penalty

    def optimize_seating(self, iterations: int = 50000):
        import math
        
        best_overall_penalty = self.calculate_penalty()
        best_overall_state = [(r, c, self.hall.get_student(r, c)) for r in range(self.hall.rows) for c in range(self.hall.cols) if self.hall.get_student(r, c) is not None]
        
        # We will do a few restarts to avoid local minima
        restarts = 5
        iters_per_restart = iterations // restarts
        
        for _ in range(restarts):
            self.place_randomly()
            current_penalty = self.calculate_penalty()
            
            # Simulated Annealing parameters
            initial_temp = 100.0
            cooling_rate = 0.99
            temp = initial_temp
            
            for i in range(iters_per_restart):
                # Pick two random positions
                r1, c1 = random.randint(0, self.hall.rows - 1), random.randint(0, self.hall.cols - 1)
                r2, c2 = random.randint(0, self.hall.rows - 1), random.randint(0, self.hall.cols - 1)
                
                if (r1, c1) == (r2, c2):
                    continue
                    
                # Swap students
                student1 = self.hall.remove_student(r1, c1)
                student2 = self.hall.remove_student(r2, c2)
                
                if student2:
                    self.hall.place_student(student2, r1, c1)
                if student1:
                    self.hall.place_student(student1, r2, c2)
                    
                new_penalty = self.calculate_penalty()
                
                # Acceptance probability
                accept = False
                if new_penalty < current_penalty:
                    accept = True
                else:
                    # Simulated Annealing acceptance
                    if temp > 0.1:
                        probability = math.exp((current_penalty - new_penalty) / temp)
                        if random.random() < probability:
                            accept = True
                
                if accept:
                    current_penalty = new_penalty
                else:
                    # Revert swap
                    s2 = self.hall.remove_student(r1, c1)
                    s1 = self.hall.remove_student(r2, c2)
                    if s1:
                        self.hall.place_student(s1, r1, c1)
                    if s2:
                        self.hall.place_student(s2, r2, c2)
                        
                # Cool down temperature
                temp *= cooling_rate
                
            # Update best overall
            if current_penalty < best_overall_penalty:
                best_overall_penalty = current_penalty
                best_overall_state = [(r, c, self.hall.get_student(r, c)) for r in range(self.hall.rows) for c in range(self.hall.cols) if self.hall.get_student(r, c) is not None]
                
        # Restore the best state found across all restarts
        self.hall.clear()
        for r, c, student in best_overall_state:
            self.hall.place_student(student, r, c)
