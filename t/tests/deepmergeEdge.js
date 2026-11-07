export default {
  deepmergeEdge: [
    {
      name: 'a null entry is an error',
      template: { 'Fn::DeepMerge': [{ a: 1 }, null] },
      catch(err) {
        return err.message === 'Fn::DeepMerge entries must not be null';
      },
    },
    {
      name: 'number and boolean entries do not discard earlier entries',
      template: { 'Fn::DeepMerge': [{ a: 1 }, 5, false, { b: 2 }] },
      output: { a: 1, b: 2 },
    },
    {
      name: 'a date replaces a scalar',
      template: { 'Fn::DeepMerge': [{ a: 1 }, { a: new Date(0) }] },
      output: { a: new Date(0) },
    },
    {
      name: 'an object replaces a date',
      template: { 'Fn::DeepMerge': [{ a: new Date(0) }, { a: { b: 1 } }] },
      output: { a: { b: 1 } },
    },
    {
      name: 'a date does not replace an object',
      template: { 'Fn::DeepMerge': [{ a: { b: 1 } }, { a: new Date(0) }] },
      output: { a: { b: 1 } },
    },
    {
      name: 'an array replaces an object',
      template: { 'Fn::DeepMerge': [{ a: { b: 1 } }, { a: [1] }] },
      output: { a: [1] },
    },
    {
      name: 'a null value replaces an object',
      template: { 'Fn::DeepMerge': [{ a: { b: 1 } }, { a: null }] },
      output: { a: null },
    },
  ],
};
