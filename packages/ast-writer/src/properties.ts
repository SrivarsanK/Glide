export interface SpacingSide {
  value: string | null;
}

export interface BoxModelProperties {
  padding: {
    top: string | null;
    right: string | null;
    bottom: string | null;
    left: string | null;
  };
  margin: {
    top: string | null;
    right: string | null;
    bottom: string | null;
    left: string | null;
  };
  width: string | null;
  height: string | null;
  position: string | null;
  offsets: {
    top: string | null;
    right: string | null;
    bottom: string | null;
    left: string | null;
  };
  rotation: string | null;
  flexDirection: string | null;
  justifyContent: string | null;
  alignItems: string | null;
  gap: string | null;
  fontFamily: string | null;
  fontWeight: string | null;
  fontSize: string | null;
  textColor: string | null;
}

export function parseTailwindClasses(classStr: string): BoxModelProperties {
  const classes = classStr.split(/\s+/).filter(Boolean);

  const props: BoxModelProperties = {
    padding: { top: null, right: null, bottom: null, left: null },
    margin: { top: null, right: null, bottom: null, left: null },
    width: null,
    height: null,
    position: null,
    offsets: { top: null, right: null, bottom: null, left: null },
    rotation: null,
    flexDirection: null,
    justifyContent: null,
    alignItems: null,
    gap: null,
    fontFamily: null,
    fontWeight: null,
    fontSize: null,
    textColor: null,
  };

  let pAll: string | null = null;
  let px: string | null = null;
  let py: string | null = null;

  let mAll: string | null = null;
  let mx: string | null = null;
  let my: string | null = null;

  classes.forEach((c) => {
    if (['absolute', 'relative', 'fixed', 'sticky', 'static'].includes(c)) {
      props.position = c;
      return;
    }

    if (c.startsWith('w-')) {
      props.width = c.substring(2);
      return;
    }
    if (c.startsWith('h-')) {
      props.height = c.substring(2);
      return;
    }

    if (c.startsWith('rotate-')) {
      props.rotation = c.substring(7);
      return;
    }

    if (c.startsWith('top-')) { props.offsets.top = c.substring(4); return; }
    if (c.startsWith('right-')) { props.offsets.right = c.substring(6); return; }
    if (c.startsWith('bottom-')) { props.offsets.bottom = c.substring(7); return; }
    if (c.startsWith('left-')) { props.offsets.left = c.substring(5); return; }

    if (['flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse'].includes(c)) {
      props.flexDirection = c.substring(5);
      return;
    }

    if (c.startsWith('justify-')) {
      props.justifyContent = c.substring(8);
      return;
    }

    if (c.startsWith('items-')) {
      props.alignItems = c.substring(6);
      return;
    }

    if (c.startsWith('gap-')) {
      props.gap = c.substring(4);
      return;
    }

    if (['font-sans', 'font-serif', 'font-mono'].includes(c)) {
      props.fontFamily = c.substring(5);
      return;
    }

    const weights = ['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black'];
    if (c.startsWith('font-') && weights.includes(c.substring(5))) {
      props.fontWeight = c.substring(5);
      return;
    }

    const fontSizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
    if (c.startsWith('text-')) {
      const rest = c.substring(5);
      if (fontSizes.includes(rest)) {
        props.fontSize = rest;
        return;
      }
      const alignments = ['left', 'center', 'right', 'justify', 'start', 'end'];
      if (!alignments.includes(rest) && !rest.startsWith('opacity-')) {
        props.textColor = rest;
        return;
      }
    }

    if (c.startsWith('p-')) { pAll = c.substring(2); return; }
    if (c.startsWith('px-')) { px = c.substring(3); return; }
    if (c.startsWith('py-')) { py = c.substring(3); return; }
    if (c.startsWith('pt-')) { props.padding.top = c.substring(3); return; }
    if (c.startsWith('pr-')) { props.padding.right = c.substring(3); return; }
    if (c.startsWith('pb-')) { props.padding.bottom = c.substring(3); return; }
    if (c.startsWith('pl-')) { props.padding.left = c.substring(3); return; }

    if (c.startsWith('m-')) { mAll = c.substring(2); return; }
    if (c.startsWith('mx-')) { mx = c.substring(3); return; }
    if (c.startsWith('my-')) { my = c.substring(3); return; }
    if (c.startsWith('mt-')) { props.margin.top = c.substring(3); return; }
    if (c.startsWith('mr-')) { props.margin.right = c.substring(3); return; }
    if (c.startsWith('mb-')) { props.margin.bottom = c.substring(3); return; }
    if (c.startsWith('ml-')) { props.margin.left = c.substring(3); return; }
  });

  props.padding.top = props.padding.top ?? py ?? pAll;
  props.padding.bottom = props.padding.bottom ?? py ?? pAll;
  props.padding.left = props.padding.left ?? px ?? pAll;
  props.padding.right = props.padding.right ?? px ?? pAll;

  props.margin.top = props.margin.top ?? my ?? mAll;
  props.margin.bottom = props.margin.bottom ?? my ?? mAll;
  props.margin.left = props.margin.left ?? mx ?? mAll;
  props.margin.right = props.margin.right ?? mx ?? mAll;

  return props;
}

export function updateTailwindClasses(classStr: string, updates: Partial<BoxModelProperties>): string {
  const classes = classStr.split(/\s+/).filter(Boolean);
  const keys = Object.keys(updates);

  const weights = ['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black'];
  const fontSizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
  const alignments = ['left', 'center', 'right', 'justify', 'start', 'end'];

  const filtered = classes.filter((c) => {
    if (keys.includes('position') && ['absolute', 'relative', 'fixed', 'sticky', 'static'].includes(c)) {
      return false;
    }
    if (keys.includes('width') && c.startsWith('w-')) return false;
    if (keys.includes('height') && c.startsWith('h-')) return false;
    if (keys.includes('rotation') && c.startsWith('rotate-')) return false;

    if (keys.includes('flexDirection') && ['flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse'].includes(c)) {
      return false;
    }
    if (keys.includes('justifyContent') && c.startsWith('justify-')) return false;
    if (keys.includes('alignItems') && c.startsWith('items-')) return false;
    if (keys.includes('gap') && c.startsWith('gap-')) return false;

    if (keys.includes('fontFamily') && ['font-sans', 'font-serif', 'font-mono'].includes(c)) {
      return false;
    }
    if (keys.includes('fontWeight') && c.startsWith('font-') && weights.includes(c.substring(5))) {
      return false;
    }
    if (keys.includes('fontSize') && c.startsWith('text-') && fontSizes.includes(c.substring(5))) {
      return false;
    }
    if (keys.includes('textColor') && c.startsWith('text-')) {
      const rest = c.substring(5);
      if (!fontSizes.includes(rest) && !alignments.includes(rest) && !rest.startsWith('opacity-')) {
        return false;
      }
    }

    if (updates.offsets) {
      if (updates.offsets.top !== undefined && c.startsWith('top-')) return false;
      if (updates.offsets.right !== undefined && c.startsWith('right-')) return false;
      if (updates.offsets.bottom !== undefined && c.startsWith('bottom-')) return false;
      if (updates.offsets.left !== undefined && c.startsWith('left-')) return false;
    }

    if (updates.padding) {
      if (c.match(/^p[xytbrl]?-/)) return false;
    }

    if (updates.margin) {
      if (c.match(/^m[xytbrl]?-/)) return false;
    }

    return true;
  });

  if (updates.position) {
    filtered.push(updates.position);
  }
  if (updates.width) {
    filtered.push(`w-${updates.width}`);
  }
  if (updates.height) {
    filtered.push(`h-${updates.height}`);
  }
  if (updates.rotation) {
    filtered.push(`rotate-${updates.rotation}`);
  }

  if (updates.flexDirection) {
    filtered.push(`flex-${updates.flexDirection}`);
  }
  if (updates.justifyContent) {
    filtered.push(`justify-${updates.justifyContent}`);
  }
  if (updates.alignItems) {
    filtered.push(`items-${updates.alignItems}`);
  }
  if (updates.gap) {
    filtered.push(`gap-${updates.gap}`);
  }

  if (updates.fontFamily) {
    filtered.push(`font-${updates.fontFamily}`);
  }
  if (updates.fontWeight) {
    filtered.push(`font-${updates.fontWeight}`);
  }
  if (updates.fontSize) {
    filtered.push(`text-${updates.fontSize}`);
  }
  if (updates.textColor) {
    filtered.push(`text-${updates.textColor}`);
  }

  if (updates.offsets) {
    if (updates.offsets.top) filtered.push(`top-${updates.offsets.top}`);
    if (updates.offsets.right) filtered.push(`right-${updates.offsets.right}`);
    if (updates.offsets.bottom) filtered.push(`bottom-${updates.offsets.bottom}`);
    if (updates.offsets.left) filtered.push(`left-${updates.offsets.left}`);
  }

  if (updates.padding) {
    const { top, right, bottom, left } = updates.padding;
    if (top && right && bottom && left && top === right && right === bottom && bottom === left) {
      filtered.push(`p-${top}`);
    } else {
      if (top && bottom && top === bottom) {
        filtered.push(`py-${top}`);
      } else {
        if (top) filtered.push(`pt-${top}`);
        if (bottom) filtered.push(`pb-${bottom}`);
      }

      if (left && right && left === right) {
        filtered.push(`px-${left}`);
      } else {
        if (left) filtered.push(`pl-${left}`);
        if (right) filtered.push(`pr-${right}`);
      }
    }
  }

  if (updates.margin) {
    const { top, right, bottom, left } = updates.margin;
    if (top && right && bottom && left && top === right && right === bottom && bottom === left) {
      filtered.push(`m-${top}`);
    } else {
      if (top && bottom && top === bottom) {
        filtered.push(`my-${top}`);
      } else {
        if (top) filtered.push(`mt-${top}`);
        if (bottom) filtered.push(`mb-${bottom}`);
      }

      if (left && right && left === right) {
        filtered.push(`mx-${left}`);
      } else {
        if (left) filtered.push(`ml-${left}`);
        if (right) filtered.push(`mr-${right}`);
      }
    }
  }

  return filtered.join(' ');
}
