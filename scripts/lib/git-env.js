// Scratch and vendor repositories must not inherit the invoking hook's repository context.
// GitHub Desktop's bundled Git needs GIT_EXEC_PATH to find its shell helpers.
module.exports = (env = process.env) => Object.fromEntries(Object.entries(env)
  .filter(([key]) => key === 'GIT_EXEC_PATH' || !key.startsWith('GIT_')));
