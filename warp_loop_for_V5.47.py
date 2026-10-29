import cv2

input_file = "V5.47Pds.mp4"
output_file = "V5.47Pds_s27.mp4"

cap = cv2.VideoCapture(input_file)
fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))  # 151 frames
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

# Output video writer
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_file, fourcc, fps, (width, height))

# Start expanding at 50% of total frames (frame 75), expanding up to 33px
start_frame = int(total_frames * 0.5)  
max_extra_pixels = 27

current_frame = 0

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    if current_frame >= start_frame:
        # Linear expansion over the last 50%
        progress = (current_frame - start_frame) / (total_frames - start_frame)
        extra_px = int(max_extra_pixels * progress)
        
        resized = cv2.resize(frame, (width + extra_px, height), interpolation=cv2.INTER_LINEAR)
        crop_start = extra_px // 2
        cropped = resized[:, crop_start:crop_start + width]
        frame = cv2.resize(cropped, (width, height), interpolation=cv2.INTER_LINEAR)

    out.write(frame)
    current_frame += 1

cap.release()
out.release()
print("Done processing V5.47Pds.mp4!")