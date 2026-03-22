// Color maps and constants
export const TM = {
  CRITICAL: { c: '#ff1744', bg: 'rgba(255,23,68,0.12)', p: true },
  HIGH:     { c: '#ff6d00', bg: 'rgba(255,109,0,0.12)', p: true },
  MODERATE: { c: '#ffd600', bg: 'rgba(255,214,0,0.10)' },
  LOW:      { c: '#00e676', bg: 'rgba(0,230,118,0.10)' },
  NORMAL:   { c: '#40c4ff', bg: 'rgba(64,196,255,0.08)' },
};

export const SC2 = { info: '#40c4ff', warning: '#ffd600', alert: '#ff6d00', emergency: '#ff1744' };
export const CC2 = { person: '#42a5f5', object: '#ab47bc', environment: '#26a69a', anomaly: '#ff7043', vehicle: '#ffa726' };
export const SVC = {
  EMS:    { c: '#ef5350', i: '🚑', l: 'EMS' },
  POLICE: { c: '#42a5f5', i: '🚔', l: 'POLICE' },
  FIRE:   { c: '#ff7043', i: '🚒', l: 'FIRE' },
};

// Prompts
export const P_GESTURE = `Check if person is RESPONDING to safety check-in with a gesture. JSON ONLY.
MOTION: __M__% (was __B__% before check-in, delta __D__%)
Return:{"gesture_detected":true|false,"gesture_type":"hand_raise|wave|thumbs_up|nod_yes|head_shake_no|sitting_up|reaching|dismissive|none","means_yes":true|false|null,"means_no":true|false|null,"description":"what person is doing","confidence":0.0-1.0}
Even 1-2% motion spike from 0% baseline = something moved. Be GENEROUS. Any deliberate movement = gesture.`;

export const P_LIGHT = `AEGIS quick-scan. JSON ONLY.
AUDIO:"""__A__"""
MOTION:__M__% (ground truth pixel-diff. >15%=moving, <5%=still. TRUST THIS.)
ESCALATIONS:__E__
Return:{"threat_level":"NORMAL"|"LOW"|"MODERATE"|"HIGH"|"CRITICAL","summary":"1 sent with motion%","people_count":0,"tags":[{"label":"str","category":"person|object|environment|anomaly|vehicle","priority":1-5}],"events":[{"description":"str","severity":"info|warning|alert|emergency","action_recommended":"str"}],"escalations":[{"id":"str","label":"str","level":0-100,"reason":"cite motion%"}],"scene_type":"indoor|outdoor|mixed","visibility":"clear|partial|obstructed|dark","confidence":0.0-1.0,"service_type":"EMS|POLICE|FIRE|NONE","hazard_detected":"fire|smoke|flood|gas|weapon|none"}
IMPORTANT: Look for environmental hazards (fire, smoke, flooding) — these are IMMEDIATE threats regardless of person motion. If fire/smoke visible, set threat_level HIGH+ and hazard_detected=fire. service_type=FIRE for fire.`;

export const P_FULL = `AEGIS elevated-scan. JSON ONLY.
AUDIO:"""__A__"""
MOTION(last 5):__H__ | NOW:__M__%
NARRATIVE:"""__N__"""
ESCALATIONS:__E__
VOICE STATE:__V__
Return:{"threat_level":"NORMAL"|"LOW"|"MODERATE"|"HIGH"|"CRITICAL","summary":"1-2 sent w/ motion%","narrative_update":"2-4 sent w/ motion trends","people_count":0,"tags":[{"label":"str","category":"person|object|environment|anomaly|vehicle","priority":1-5}],"events":[{"description":"str w/ motion%","severity":"info|warning|alert|emergency","action_recommended":"str"}],"escalations":[{"id":"str","label":"str","level":0-100,"reason":"cite motion%. If recovered >15%, set 0."}],"scene_type":"indoor|outdoor|mixed","visibility":"clear|partial|obstructed|dark","confidence":0.0-1.0,"service_type":"EMS|POLICE|FIRE|NONE","hazard_detected":"fire|smoke|flood|gas|weapon|none","should_voice_check":false,"voice_check_message":"Only if esc 35-75, motion<10%, voice idle"}
HAZARD RULE: If fire/smoke/weapon visible, escalation should jump to 80+ immediately. Hazards don't need voice check — dispatch fire/police directly.
MOTION TRUTH: >20%=active→deescalate. If voice="denied"→level 0.`;
