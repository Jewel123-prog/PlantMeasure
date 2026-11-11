// The prompt lives on the server so the proxy cannot be used as a free general-purpose model endpoint.

/** Keep user-supplied free text short and single-line before it goes into the prompt. */
export function cleanField(value, max = 60) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f<>{}`"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildPrompt({ species, refName, refCm }) {
  const sp = cleanField(species);
  const rn = cleanField(refName) || 'reference object';
  return `You are a plant phenotyping assistant. Analyze the attached photo${sp ? ' of ' + sp : ''}. A reference object (${rn}, known length ${refCm} cm) may be visible.
All coordinates are normalized [x,y] in 0-1 (origin top-left). Reply with ONLY JSON, no markdown:
{"reference":{"found":bool,"p1":[x,y],"p2":[x,y]} (endpoints of the reference object's known-length dimension),
"leaf_count":int,"color":"short description of leaf color","health":"good|fair|poor","health_notes":"one sentence (damage, chlorosis, spots, wilting)",
"leaves":[{"length":[[x,y],[x,y]],"width":[[x,y],[x,y]]}] (up to 4 clearest, fully visible leaves; length along midrib base to tip, width at the widest point),
"stem":{"height":[[x,y],[x,y]],"diameter":[[x,y],[x,y]]} (base to top; diameter across stem) or null,
"fruit":{"diameter":[[x,y],[x,y]]} or null,"confidence":"low|medium|high"}
Be precise with endpoints. Omit anything you cannot see rather than guessing.`;
}
