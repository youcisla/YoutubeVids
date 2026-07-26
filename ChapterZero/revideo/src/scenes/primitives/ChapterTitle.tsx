import { Rect, Txt, makeScene2D } from '@revideo/2d';

/**
 * ChapterTitle — top-left block: small-caps book title + chapter badge.
 * Mirrors the HyperFrames `compositions/intro.html` block but parameterized.
 */
export default makeScene2D(function* (view) {
  view.add(
    <>
      <Txt
        x={-800}
        y={-440}
        fontSize={28}
        fontWeight={700}
        letterSpacing={6}
        fill={'#7aa0ff'}
        text={'' /* Variable bound: bookTitle */}
      />
      <Rect
        x={-800}
        y={-380}
        width={220}
        height={64}
        radius={10}
        fill={'#ff5a3c'}
      >
        <Txt
          x={0}
          y={0}
          fontSize={32}
          fontWeight={900}
          fill={'#ffffff'}
          text={'' /* Variable bound: chapterLabel */}
        />
      </Rect>
    </>,
  );
});
