import { Rect, makeScene2D } from '@revideo/2d';

export default makeScene2D(function* (view) {
  // ponytail: solid dark-navy base matches the HyperFrames project palette.
  // Future: animated gradient + orbs (the current HTML bg animations).
  view.add(
    <Rect
      width={'100%'}
      height={'100%'}
      fill={'#0a1633'}
    />,
  );
});
