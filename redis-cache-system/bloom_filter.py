"""Bloom filter for cache penetration prevention."""

import math
import hashlib


class BloomFilter:
    """Memory-efficient probabilistic set for checking article existence."""

    def __init__(self, expected_items: int = 100000, false_positive_rate: float = 0.001):
        self.size = self._optimal_size(expected_items, false_positive_rate)
        self.hash_count = self._optimal_hashes(self.size, expected_items)
        self.bitmap = [False] * self.size
        self.item_count = 0

    @staticmethod
    def _optimal_size(n: int, p: float) -> int:
        return int(-n * math.log(p) / (math.log(2) ** 2))

    @staticmethod
    def _optimal_hashes(m: int, n: int) -> int:
        return max(1, int((m / n) * math.log(2)))

    def _hash(self, item: str, seed: int) -> int:
        """SHA256-based double hashing to simulate k independent hash functions."""
        h = hashlib.sha256(f"{seed}:{item}".encode()).digest()
        return int.from_bytes(h[:8], 'big')

    def _positions(self, item: str) -> list[int]:
        h1 = self._hash(item, 42)
        h2 = self._hash(item, 137)
        return [(h1 + i * h2) % self.size for i in range(self.hash_count)]

    def add(self, item: str) -> None:
        for pos in self._positions(item):
            self.bitmap[pos] = True
        self.item_count += 1

    def might_contain(self, item: str) -> bool:
        return all(self.bitmap[pos] for pos in self._positions(item))

    def bulk_load(self, items: list[str]) -> None:
        for item in items:
            self.add(item)

    @property
    def stats(self) -> dict:
        true_negatives = sum(1 for b in self.bitmap if not b)
        fill_rate = 1 - (true_negatives / self.size)
        return {
            "expected_items": self.item_count,
            "bitmap_size": self.size,
            "hash_functions": self.hash_count,
            "fill_rate": round(fill_rate, 4),
            "memory_kb": round(self.size / 8 / 1024, 1),
            "target_fpr": 0.001,
        }
