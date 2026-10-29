import cv2
import numpy as np

input_file = "V6Lds.mp4"
output_file = "V6Lds_stretched_loop.mp4"

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
start_frame = int(total_frames * 0.50)  # Start of last 50%
max_extra_pixels = 27  # Adjust as needed

# 2. Reverse the frame sequence
frames.reverse()

# 3. Apply the horizontal stretch to the last 25% of the reversed frames
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

# 4. Reverse back to original order (so stretch now sits on the first 25%)
processed_frames.reverse()

# 5. Write the final video
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_file, fourcc, fps, (width, height))

for frame in processed_frames:
    out.write(frame)

out.release()
print("Done processing V6Lds.mp4!")