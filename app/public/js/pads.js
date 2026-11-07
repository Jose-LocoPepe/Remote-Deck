// Modos de pads, como en las controladoras: qué hace cada uno de los 8 pads.
// Mapeos verificados en vivo (Serato DJ Pro 4.0.2); ver research/ACI-FINDINGS.md.

// Índice de tamaño de loop en Serato: 0 = 1/32 beat, y cada paso duplica.
const LOOP_SIZES = ['1/32', '1/16', '1/8', '1/4', '1/2', '1', '2', '4', '8', '16', '32'];
const beatsOf = (idx) => 2 ** (idx - 5);

export const PAD_MODES = {
  hotcue: {
    label: 'HOT CUE',
    // Mantener: valor 1 al presionar, 0 al soltar
    pads: Array.from({ length: 8 }, (_, i) => ({ label: String(i + 1), name: 'cue_point', prop: i, hold: true })),
  },
  loop: {
    label: 'LOOP',
    // Auto loop por tamaño: 1/4 … 32 beats. Tocar de nuevo el activo lo quita.
    pads: [3, 4, 5, 6, 7, 8, 9, 10].map((idx) => ({
      label: LOOP_SIZES[idx], name: 'auto_loop_specific_length', prop: idx, hold: false, beats: beatsOf(idx), toggleLoop: true,
    })),
  },
  roll: {
    label: 'ROLL',
    // Loop roll: activo solo mientras se mantiene el pad
    pads: [1, 2, 3, 4, 5, 6, 7, 8].map((idx) => ({
      label: LOOP_SIZES[idx], name: 'auto_loop_roll_specific_length', prop: idx, hold: true, beats: beatsOf(idx),
    })),
  },
  sampler: {
    label: 'SAMPLER',
    beta: true,
    pads: Array.from({ length: 8 }, (_, i) => ({ label: `S${i + 1}`, name: 'sample_player_slot_play', prop: i, hold: false })),
  },
  stems: {
    label: 'STEMS',
    disabled: true,
    hint: 'Serato no expone los stems por el protocolo Remote (pendiente de investigar).',
    pads: [],
  },
};
