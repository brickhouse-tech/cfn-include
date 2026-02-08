export default {
  ifEval: [
    {
      name: 'truthy',
      doEval: true,
      template: {
        'Fn::Eval': {
          state: [1, 2, 3],
          script: `state.map((v) => 2 * v);`,
        },
      },
      output: [2, 4, 6],
    },
    {
      name: 'should fail',
      doEval: false,
      // test should fail as doEval is disabled
      catch: (err) => err instanceof Error,
      template: {
        'Fn::Eval': {},
      },
    },
  ],
};
