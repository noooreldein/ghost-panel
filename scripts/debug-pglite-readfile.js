(async () => {
  try {
    const fsPromises = await import('fs/promises');
    const origRead = fsPromises.readFile;
    fsPromises.readFile = async function (arg, ...rest) {
      try {
        console.log('DEBUG fs.readFile arg typeof=', typeof arg);
        console.log('DEBUG fs.readFile instanceof URL=', arg instanceof URL);
        console.log('DEBUG fs.readFile constructor.name=', arg && arg.constructor && arg.constructor.name);
        try {
          console.log('DEBUG fs.readFile toString=', arg && arg.toString && arg.toString());
        } catch (e) {
          console.log('DEBUG fs.readFile toString() threw', e);
        }
      } catch (e) {
        console.error('DEBUG logging error', e);
      }
      return origRead.call(this, arg, ...rest);
    };

    console.log('patched fs.promises.readFile');

    const mod = await import('@electric-sql/pglite');
    console.log('imported @electric-sql/pglite exports:', Object.keys(mod));

    const PGlite = mod.PGlite || mod.default || mod;
    console.log('PGlite constructor found:', typeof PGlite === 'function');

    const dataDir = process.env.DATABASE_URL || 'file:.data/ghost-panel-pglite-wasm';
    console.log('using dataDir=', dataDir);

    try {
      const inst = new PGlite(dataDir);
      console.log('PGlite instance created');
      // try a simple call if available
      if (typeof inst.close === 'function') {
        await inst.close();
        console.log('closed instance');
      }
    } catch (e) {
      console.error('error creating/using PGlite instance:', e);
    }
  } catch (e) {
    console.error('script error', e);
    process.exit(1);
  }
})();
