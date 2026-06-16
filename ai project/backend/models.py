from dataclasses import dataclass, field
from typing import List

@dataclass
class Student:
    student_id: str
    name: str
    subject: str
    friends: List[str] = field(default_factory=list)
    cheating_risk_score: int = 3
    priority_score: float = 0.0
    friend_group_id: int = 0 # Keeping for legacy UI compatibility if needed, but we use friends list now
