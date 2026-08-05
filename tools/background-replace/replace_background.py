import argparse
import os
import sys

import cv2
import numpy as np
import torch


IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}


def cover_frame(frame, width, height):
    source_height, source_width = frame.shape[:2]
    scale = max(width / source_width, height / source_height)
    resized_width = max(width, int(round(source_width * scale)))
    resized_height = max(height, int(round(source_height * scale)))
    resized = cv2.resize(frame, (resized_width, resized_height), interpolation=cv2.INTER_AREA)
    left = (resized_width - width) // 2
    top = (resized_height - height) // 2
    return resized[top:top + height, left:left + width]


class BackgroundReader:
    def __init__(self, path, width, height):
        self.path = path
        self.width = width
        self.height = height
        self.image = None
        self.capture = None

        extension = os.path.splitext(path)[1].lower()
        if extension in IMAGE_EXTENSIONS:
            image = cv2.imread(path, cv2.IMREAD_COLOR)
            if image is None:
                raise RuntimeError('无法读取背景图片')
            self.image = cover_frame(image, width, height)
        else:
            self.capture = cv2.VideoCapture(path)
            if not self.capture.isOpened():
                raise RuntimeError('无法读取背景视频')

    def next(self):
        if self.image is not None:
            return self.image

        ok, frame = self.capture.read()
        if not ok:
            self.capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = self.capture.read()
        if not ok:
            raise RuntimeError('背景视频中没有可用画面')
        return cover_frame(frame, self.width, self.height)

    def close(self):
        if self.capture is not None:
            self.capture.release()


def replace_background(
    source_path,
    background_path,
    output_path,
    model_path,
    max_side=512,
    edge_mode='none',
    edge_amount=0,
):
    if not torch.cuda.is_available():
        raise RuntimeError('未检测到可用的 NVIDIA 显卡')

    source = cv2.VideoCapture(source_path)
    if not source.isOpened():
        raise RuntimeError('无法读取源视频')

    width = int(source.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(source.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = source.get(cv2.CAP_PROP_FPS) or 25.0
    frame_count = max(1, int(source.get(cv2.CAP_PROP_FRAME_COUNT)))
    if width <= 0 or height <= 0:
        raise RuntimeError('源视频尺寸无效')

    background = BackgroundReader(background_path, width, height)
    writer = cv2.VideoWriter(
        output_path,
        cv2.VideoWriter_fourcc(*'mp4v'),
        fps,
        (width, height),
    )
    if not writer.isOpened():
        raise RuntimeError('无法创建输出视频')

    device = torch.device('cuda')
    model = torch.jit.load(model_path, map_location=device).eval()
    recurrent = [None] * 4
    downsample_ratio = min(1.0, float(max_side) / max(width, height))
    processed = 0

    try:
        with torch.inference_mode():
            while True:
                ok, frame = source.read()
                if not ok:
                    break

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                tensor = torch.from_numpy(rgb).to(device=device, dtype=torch.float16)
                tensor = tensor.permute(2, 0, 1).unsqueeze(0).div_(255.0)
                foreground, alpha, *recurrent = model(tensor, *recurrent, downsample_ratio)

                alpha_np = alpha[0][0].float().cpu().numpy()
                if edge_mode == 'feather' and edge_amount > 0:
                    sigma = max(0.1, float(edge_amount) * 0.5)
                    alpha_np = cv2.GaussianBlur(alpha_np, (0, 0), sigmaX=sigma)
                elif edge_mode == 'erode' and edge_amount > 0:
                    kernel_size = 2 * max(1, int(edge_amount)) + 1
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
                    alpha_np = cv2.erode(alpha_np, kernel)
                alpha_t = (
                    torch.from_numpy(alpha_np)
                    .to(device=device, dtype=torch.float16)
                    .unsqueeze(0)
                    .unsqueeze(0)
                )

                background_rgb = cv2.cvtColor(background.next(), cv2.COLOR_BGR2RGB)
                background_tensor = torch.from_numpy(background_rgb).to(
                    device=device, dtype=torch.float16
                )
                background_tensor = background_tensor.permute(2, 0, 1).unsqueeze(0).div_(255.0)
                composition = foreground * alpha_t + background_tensor * (1.0 - alpha_t)
                composition = composition[0].permute(1, 2, 0).mul(255).byte().cpu().numpy()
                writer.write(cv2.cvtColor(composition, cv2.COLOR_RGB2BGR))

                processed += 1
                if processed == 1 or processed % max(1, int(fps)) == 0:
                    progress = min(99, round(processed * 100 / frame_count))
                    print(f'PROGRESS {progress}', flush=True)
    finally:
        source.release()
        background.close()
        writer.release()

    if processed == 0:
        raise RuntimeError('源视频中没有可用画面')
    print('PROGRESS 100', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--background', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--model', required=True)
    parser.add_argument('--max-side', type=int, default=512, help='内部分辨率上限，越大越精细（512 快速 / 768 高清）')
    parser.add_argument(
        '--edge-mode',
        choices=['none', 'feather', 'erode'],
        default='none',
        help='边缘处理：none 不处理 / feather 羽化 / erode 收缩去边',
    )
    parser.add_argument('--edge-amount', type=int, default=0, help='边缘处理强度 1-10')
    args = parser.parse_args()
    replace_background(
        args.source,
        args.background,
        args.output,
        args.model,
        args.max_side,
        args.edge_mode,
        args.edge_amount,
    )


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'ERROR {error}', file=sys.stderr, flush=True)
        raise
