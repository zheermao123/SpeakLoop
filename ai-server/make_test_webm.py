"""生成 440Hz 正弦波 webm/opus 测试文件（验证 /stt 解码链路用）"""
import av
import numpy as np

sr = 16000
t = np.linspace(0, 2, sr * 2, endpoint=False)
samples = (np.sin(2 * np.pi * 440 * t) * 10000).astype(np.int16)

container = av.open("test_webm.webm", mode="w", format="webm")
stream = container.add_stream("libopus", rate=sr)
stream.layout = "mono"
for i in range(0, len(samples), 1024):
    frame = av.AudioFrame.from_ndarray(
        samples[i : i + 1024].reshape(1, -1), format="s16", layout="mono"
    )
    frame.rate = sr
    for packet in stream.encode(frame):
        container.mux(packet)
for packet in stream.encode():
    container.mux(packet)
container.close()
print("test_webm.webm written")
