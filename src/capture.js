// Frame capture utilities
export function capFrame() {
  const v = document.getElementById('vid'), c = document.getElementById('cap');
  c.width = v.videoWidth || 640;
  c.height = v.videoHeight || 480;
  c.getContext('2d').drawImage(v, 0, 0);
  return c.toDataURL('image/jpeg', 0.65).split(',')[1];
}

export function capEvidence() {
  const v = document.getElementById('vid'), c = document.createElement('canvas');
  c.width = v.videoWidth || 640;
  c.height = v.videoHeight || 480;
  c.getContext('2d').drawImage(v, 0, 0);
  return c.toDataURL('image/jpeg', 0.8);
}

export function capGestureFrame() {
  const v = document.getElementById('vid'), c = document.createElement('canvas');
  c.width = v.videoWidth || 640;
  c.height = v.videoHeight || 480;
  c.getContext('2d').drawImage(v, 0, 0);
  return c.toDataURL('image/jpeg', 0.6).split(',')[1];
}
