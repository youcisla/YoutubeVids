function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function validateChapter(data, options = {}) {
  if (!data || typeof data !== 'object') throw new Error('Chapter must be an object');
  if (typeof data.narration_script !== 'string' || !data.narration_script.trim()) {
    throw new Error('Missing required field: "narration_script"');
  }
  if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
    throw new Error('scenes must be a non-empty array');
  }

  let previousEnd = 0;
  data.scenes.forEach((scene, sceneIndex) => {
    if (!scene || typeof scene !== 'object') throw new Error(`Scene ${sceneIndex} must be an object`);
    if (typeof scene.html !== 'string' || !scene.html.trim()) throw new Error(`Scene ${sceneIndex} missing html`);
    if (typeof scene.animations !== 'string' || !scene.animations.trim()) throw new Error(`Scene ${sceneIndex} missing animations`);
    if (!finiteNonNegative(scene.duration) || scene.duration <= 0) throw new Error(`Scene ${sceneIndex} has invalid duration`);
    if (!finiteNonNegative(scene.timestamp_end)) throw new Error(`Scene ${sceneIndex} has invalid timestamp_end`);
    if (!Array.isArray(scene.captions) || scene.captions.length === 0) throw new Error(`Scene ${sceneIndex} captions must be non-empty`);

    let previousCaptionEnd = 0;
    scene.captions.forEach((caption, captionIndex) => {
      if (!caption || typeof caption !== 'object') throw new Error(`Scene ${sceneIndex} caption ${captionIndex} must be an object`);
      if (typeof caption.text !== 'string') throw new Error(`Scene ${sceneIndex} caption ${captionIndex} text must be a string`);
      if (options.strict && !caption.text.trim()) throw new Error(`Scene ${sceneIndex} caption ${captionIndex} text must be non-empty`);
      if (!finiteNonNegative(caption.start) || !finiteNonNegative(caption.end) || caption.end <= caption.start) {
        throw new Error(`Scene ${sceneIndex} caption ${captionIndex} has invalid timing`);
      }
      if (caption.start < previousCaptionEnd) throw new Error(`Scene ${sceneIndex} caption ${captionIndex} overlaps previous caption`);
      if (options.strict && caption.end > scene.duration) throw new Error(`Scene ${sceneIndex} caption ${captionIndex} exceeds duration`);
      previousCaptionEnd = caption.end;
    });

    if (options.strict) {
      const expectedEnd = previousEnd + scene.duration;
      if (Math.abs(scene.timestamp_end - expectedEnd) > 0.001) {
        throw new Error(`Scene ${sceneIndex} timestamp_end must equal cumulative duration ${expectedEnd}`);
      }
    }
    if (scene.timestamp_end <= previousEnd) throw new Error(`Scene ${sceneIndex} timestamp_end must increase`);
    previousEnd = scene.timestamp_end;
  });
  return true;
}

module.exports = { validateChapter };
