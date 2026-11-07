// Vistas disponibles. `count` = decks visibles; `mixer` = muestra el mixer.
export const LAYOUTS = {
  classic: { label: 'Clásica', hint: 'Dos decks lado a lado', count: 2, mixer: true, icon: 'M3 5h7v14H3zM14 5h7v14h-7z' },
  horizontal: { label: 'Horizontal', hint: 'Ondas apiladas, a lo ancho', count: 2, mixer: true, icon: 'M3 4h18v6H3zM3 14h18v6H3z' },
  compact: { label: 'Compacta', hint: 'Solo tiempo y controles grandes', count: 2, mixer: false, icon: 'M3 6h18v4H3zM3 14h18v4H3z' },
  four: { label: '4 decks', hint: 'Los cuatro decks a la vez', count: 4, mixer: false, icon: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z' },
  single: { label: 'Un deck', hint: 'Un deck a pantalla completa', count: 1, mixer: false, icon: 'M4 3h16v18H4z' },
};
