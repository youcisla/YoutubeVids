import json
import sys

from faster_whisper import WhisperModel


def main():
    model_size, audio_path, output_path = sys.argv[1:4]
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, word_timestamps=True)
    result = {"segments": []}
    for segment in segments:
        words = [
            {"word": word.word, "start": word.start, "end": word.end}
            for word in (segment.words or [])
        ]
        result["segments"].append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
            "words": words,
        })
    with open(output_path, "w", encoding="utf-8") as output:
        json.dump(result, output)


if __name__ == "__main__":
    main()
