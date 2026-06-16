import csv
import random
from typing import List, Optional

def generate_student_data(
    num_students: int, 
    subjects: Optional[List[str]] = None, 
    high_risk_percentage: int = 20,
    num_friend_groups: int = 20,
    filename: str = "students.csv"
):
    if not subjects:
        subjects = ["Math", "Physics", "Chemistry", "Biology", "Computer Science"]
        
    friend_groups = list(range(1, num_friend_groups + 1))
    
    data = []
    for i in range(1, num_students + 1):
        student_id = f"S{i:03d}"
        name = f"Student_{i}"
        subject = random.choice(subjects)
        friend_group_id = random.choice(friend_groups)
        
        # Determine cheating risk based on percentage
        if random.randint(1, 100) <= high_risk_percentage:
            cheating_risk_score = random.randint(7, 10)  # High risk
        else:
            cheating_risk_score = random.randint(1, 6)   # Normal/Low risk
        
        data.append({
            "StudentID": student_id,
            "Name": name,
            "Subject": subject,
            "FriendGroupID": friend_group_id,
            "CheatingRiskScore": cheating_risk_score
        })
        
    with open(filename, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["StudentID", "Name", "Subject", "FriendGroupID", "CheatingRiskScore"])
        writer.writeheader()
        writer.writerows(data)
        
    print(f"Generated {num_students} students in {filename}")
