import cv2
import numpy as np

input_file = "V1Lrus.mp4"
output_file = "V1Lrus_s36.mp4"

cap = cv2.VideoCapture(input_file)
fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

# Output video writer
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_file, fourcc, fps, (width, height))

start_frame = 256
max_extra_pixels = 37

current_frame = 0

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    if current_frame >= start_frame:
        progress = (current_frame - start_frame) / (total_frames - start_frame)
        extra_px = int(max_extra_pixels * progress)
        
        # Resize horizontally
        resized = cv2.resize(frame, (width + extra_px, height), interpolation=cv2.INTER_LINEAR)
        
        # Crop precisely back to original width and height
        crop_start = extra_px // 2
        cropped = resized[:, crop_start:crop_start + width]
        
        # Guarantee exact output dimensions to avoid OpenCV exception
        frame = cv2.resize(cropped, (width, height), interpolation=cv2.INTER_LINEAR)

    out.write(frame)
    current_frame += 1

cap.release()
out.release()
print("Done processing successfully!")