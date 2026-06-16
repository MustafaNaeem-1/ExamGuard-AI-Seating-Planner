from typing import List
from models import Student

class ExamHall:
    def __init__(self, rows: int, cols: int):
        self.rows = rows
        self.cols = cols
        self.grid = [[None for _ in range(cols)] for _ in range(rows)]

    def get_capacity(self):
        return self.rows * self.cols

    def place_student(self, student, r, c):
        self.grid[r][c] = student

    def remove_student(self, r, c):
        student = self.grid[r][c]
        self.grid[r][c] = None
        return student

    def get_student(self, r, c):
        if 0 <= r < self.rows and 0 <= c < self.cols:
            return self.grid[r][c]
        return None

    def get_adjacent_students(self, row: int, col: int) -> List[Student]:
        adjacent = []
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]

        for dr, dc in directions:
            r, c = row + dr, col + dc
            student = self.get_student(r, c)
            if student is not None:
                adjacent.append(student)

        return adjacent

    def clear(self):
        self.grid = [[None for _ in range(self.cols)] for _ in range(self.rows)]

    def copy(self):
        new_hall = ExamHall(self.rows, self.cols)
        for r in range(self.rows):
            for c in range(self.cols):
                new_hall.grid[r][c] = self.grid[r][c]
        return new_hall