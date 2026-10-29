import cv2
import os

video_path = r"C:\Users\viraj\Downloads\web\\master\V2Pds_t_s36.mp4"

output_folder = os.path.dirname(video_path)

video = cv2.VideoCapture(video_path)

if not video.isOpened():
    print("❌ Could not open video.")
    exit()

total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))

print(f"Total Frames: {total_frames}")

frames_to_extract = {
    #"last_frame": total_frames - 1,
    "first_frame": max(0, 0),
    #"frame_minus_192": max(total_frames - 193, 0)
}

for name, frame_number in frames_to_extract.items():

    video.set(cv2.CAP_PROP_POS_FRAMES, frame_number)

    success, frame = video.read()

    if success:
        filename = os.path.join(output_folder, f"{name}.png")
        cv2.imwrite(filename, frame)
        print(f"✅ Saved {filename}")

video.release()

print("\nDone!")