# run in terminal using python name.py

import cv2
import numpy as np

input_file = "V2Pds.mp4"
output_file = "V2Pds_s36.mp4"

cap = cv2.VideoCapture(input_file)
fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

# 1. Read all frames into memory
frames = []
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    frames.append(frame)
cap.release()

total_frames = len(frames)
start_frame = int(total_frames * 0.75)  # Start of last 25% (for reversed logic)
max_extra_pixels = 36  # Matched to V1's final 36px expansion

# 2. Reverse sequence to process start of video as end
frames.reverse()

# 3. Apply taper logic
processed_frames = []
for current_frame, frame in enumerate(frames):
    if current_frame >= start_frame:
        progress = (current_frame - start_frame) / (total_frames - start_frame)
        extra_px = int(max_extra_pixels * progress)
        
        resized = cv2.resize(frame, (width + extra_px, height), interpolation=cv2.INTER_LINEAR)
        crop_start = extra_px // 2
        cropped = resized[:, crop_start:crop_start + width]
        frame = cv2.resize(cropped, (width, height), interpolation=cv2.INTER_LINEAR)

    processed_frames.append(frame)

# 4. Flip back so Frame 1 starts at 36px and tapers down to 0px
processed_frames.reverse()

# 5. Write video file
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_file, fourcc, fps, (width, height))

for frame in processed_frames:
    out.write(frame)

out.release()
print("Done processing V2Pds.mp4!")