#!/usr/bin/env python3
"""Full voiceprint test"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'modules'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'modules'))
import numpy as np

from friday_voiceprint import VoiceprintRecognizer
from voiceprint_gate import VoiceprintGate

# Create fresh recognizer (delete old profile)
profile_file = os.path.join(os.path.dirname(__file__), '..', 'modules', 'voiceprint_profiles.pkl')
if os.path.exists(profile_file):
    os.remove(profile_file)
    print("Deleted old voiceprint")

# Generate synthetic voice data
t = np.linspace(0, 1, 16000)
# Owner voice: rich harmonics (simulates a real voice)
owner_voice = (np.sin(2 * np.pi * 200 * t) + 
               0.6 * np.sin(2 * np.pi * 300 * t) + 
               0.3 * np.sin(2 * np.pi * 400 * t) +
               0.1 * np.sin(2 * np.pi * 500 * t))

# Stranger voice: completely different spectrum
stranger_voice = (np.sin(2 * np.pi * 800 * t) + 
                  0.5 * np.sin(2 * np.pi * 1000 * t) + 
                  0.2 * np.sin(2 * np.pi * 1200 * t))

print("=" * 50)
print("Voiceprint Enrollment & Verification Test")
print("=" * 50)

# Step 1: Enroll
print("\n[Step 1] Enrolling owner voice (3 samples)...")
vpr = VoiceprintRecognizer(threshold=0.75)
for i in range(3):
    variant = owner_voice + np.random.normal(0, 0.005, len(t))
    emb = vpr.enroll(variant, "owner")
    print(f"  Sample {i+1}: enrolled, embedding dim={len(emb)}")

profile = vpr.speaker_profiles["owner"]
print(f"\n  Profile: {profile['samples']} samples, threshold={vpr.threshold}")

# Step 2: Test verification
print("\n[Step 2] Testing verification...")
gate = VoiceprintGate(threshold=0.75)

# Test owner voice (with noise variation)
for i in range(3):
    test = owner_voice + np.random.normal(0, 0.01, len(t))
    passed, sim, name = gate.verify(test)
    status = "PASS" if passed else "FAIL"
    print(f"  Owner test {i+1}: similarity={sim:.3f} [{status}]")

# Test stranger voice
for i in range(3):
    passed, sim, name = gate.verify(stranger_voice + np.random.normal(0, 0.01, len(t)))
    status = "REJECT" if not passed else "FAIL"
    print(f"  Stranger test {i+1}: similarity={sim:.3f} [{status}]")

print("\n" + "=" * 50)
print("Test complete!")
print("=" * 50)
