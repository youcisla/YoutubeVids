import { Audio, Txt, makeScene2D } from '@revideo/2d';
import Background from './primitives/Background';
import ChapterTitle from './primitives/ChapterTitle';
import Captions from './primitives/Captions';

/**
 * TeaserScene — single scene that renders the full teaser timeline.
 *
 * Reads the chapter's audio duration + caption cues from project variables
 * (populated by render-chapter.mjs) and drives:
 *   - audio playback
 *   - caption text swap per cue
 *   - the static chapter-title block (no animation in v1)
 *
 * v2 will add: animated chapter title fade-in, stats counter (1%→37x),
 * per-word karaoke captions.
 */
export default makeScene2D(function* (view) {
  // Resolve vars (Revideo Variables are functions that return the current value)
  const bookTitle = (view.variables as any).bookTitle() as string;
  const chapterNumber = (view.variables as any).chapterNumber() as number;
  const chapterTitle = (view.variables as any).chapterTitle() as string;
  const audioPath = (view.variables as any).audioPath() as string;
  const audioDurationSec = (view.variables as any).audioDurationSec() as number;
  const captions = (view.variables as any).captions() as Array<{ start: number; end: number; text: string }>;
  const stat = (view.variables as any).stat() as { from: string; to: string; atSec: number };

  // 1) Audio — played for the full scene duration
  view.add(
    <Audio
      src={audioPath}
      play={true}
    />,
  );

  // 2) Static background
  view.add(<Background />);

  // 3) Top chapter-title block
  view.add(<ChapterTitle />);
  // Bind text values to the ChapterTitle's child Txts via separate nodes
  view.add(
    <Txt
      x={-800}
      y={-440}
      fontSize={28}
      fontWeight={700}
      letterSpacing={6}
      fill={'#7aa0ff'}
      text={(bookTitle || '').toUpperCase()}
    />,
  );
  view.add(
    <Txt
      x={-690}
      y={-348}
      fontSize={32}
      fontWeight={900}
      fill={'#ffffff'}
      text={`CHAPTER ${chapterNumber}`}
    />,
  );

  // 4) Center stat — fades in around `stat.atSec`
  const statTxt = view.add(
    <Txt
      x={0}
      y={0}
      fontSize={180}
      fontWeight={900}
      fill={'#ff5a3c'}
      text={`${stat?.from ?? '1%'} → ${stat?.to ?? '37×'}`}
      opacity={0}
    />,
  );
  if (stat?.atSec != null) {
    yield* statTxt.opacity(1, 0.4);
  }

  // 5) Chapter title — fades in mid-scene
  const titleTxt = view.add(
    <Txt
      x={0}
      y={180}
      fontSize={64}
      fontWeight={800}
      fill={'#ffffff'}
      text={chapterTitle || ''}
      textAlign={'center'}
      width={1600}
      opacity={0}
    />,
  );
  yield* titleTxt.opacity(1, 0.6);

  // 6) Bottom captions — swap on each cue
  const captionTxt = view.add(
    <Txt
      x={0}
      y={420}
      width={1700}
      textAlign={'center'}
      fontSize={56}
      fontWeight={700}
      fill={'#ffffff'}
      text={''}
    />,
  );

  // Walk through cues; the audio timeline drives the swaps.
  for (const cue of captions || []) {
    yield* captionTxt.text(cue.text, cue.end - cue.start);
  }

  // Hold the last frame for a short tail so the video doesn't cut off the audio
  yield* view.waitFor(Math.max(0.3, audioDurationSec * 0.05));
});
