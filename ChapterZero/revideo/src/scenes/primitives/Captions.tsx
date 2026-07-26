import { Txt, makeScene2D } from '@revideo/2d';

/**
 * Captions — bottom-center, single-line at a time, caption swaps every cue.
 *
 * ponytail: simple swap is the v1. v2 = per-word karaoke (each word in the
 * caption is its own Txt that fades/slides in at the right sub-cue time,
 * computed by splitting the caption's [start, end] window evenly across its
 * words). Even spacing sounds robotic for ASR-derived timings; the v1
 * whole-caption swap reads more natural for an Adam-style deep male voice.
 */
export default makeScene2D(function* (view) {
  view.add(
    <Txt
      x={0}
      y={420}
      width={1700}
      textAlign={'center'}
      fontSize={56}
      fontWeight={700}
      fill={'#ffffff'}
      text={'' /* Variable bound: activeCaptionText */}
    />,
  );
});
