var getArgs = require('typedef').getArguments;
var _       = require('underscore');

module.exports = Container;

/**
 * Basic dependency resolver that allows for the registering of types and
 * factories via callback functions, as well as auto-guessing constructor
 * injecting via parameter names
 * @constructor
 */
function Container()
{
  this._types = {};

  this.register('resolver', this);
}

/**
 * Register a class constructor into the container.
 * @param {String} name The name we want register something under.
 * @param {Function} T The class constructor of the type we want to register.
 * @param {boolean=} shared If true, this dep will only be instantiated once (a
 * la singleton)
 */
Container.prototype.register = function(name, T, shared)
{
  if (this._types[name])
    throw new Error(
      'Already registered dependency: "' + name + '"');

  // Determine if there are any other deps in here
  var deps = getArgs(T);

  this._types[name] = {
    type: T,
    deps: deps,
    shared: !!shared,
    instance: null
  };
};

/**
 * Register a singleton (instantiated-once) class constructor dependency into
 * this resolver.
 * @param {String} name The name we want register something under.
 * @param {Function} T The class constructor of the type we want to register.
 */
Container.prototype.singleton = function(name, T)
{
  return this.register(name, T, true);
};

/**
 * @param {String} name Abstract name.
 * @return {bool} True if a type is registered already.
 */
Container.prototype.isRegistered = function(name)
{
  return !!this._types[name];
};

/**
 * Create an object while resolving any dependencies we have have
 * @param {String} name The string tag of the dependency we want to create.
 * @return {Object} The dependency.
 */
Container.prototype.make = function(name)
{
  // Use parameter names of the function to bring in more deps
  if (name instanceof Function)
    return this.makeFromConstructor(name);

  // Nop if we are passing in something weird
  if (!_(name).isString())
    return name;

  var info = this._resolve(name);

  // If we have just a normal thing, return it
  if (!(info.type instanceof Function))
    return info.type;

  // Resolve all string deps into make deps
  var _this = this;

  var instance;

  if (!info.shared || !info.instance) {
    var deps = info.deps.map(function(d) { return _this.make(d); });
    instance = callNew(info.type, deps);

    // Stash singleton
    if (info.shared)
      info.instance = instance;
  } else {
    instance = info.instance;
  }

  return instance;
};


// Give us a way to instantiate a new class with an array of args
function callNew(T, args)
{
  function F() { return T.apply(this, args); }
  F.prototype = T.prototype;
  return new F();
}

/**
 * Create an object by resolving deps for a class not in the container (but
 * whose deps are)
 * @param {Function} T Constructor function.
 */
Container.prototype.makeFromConstructor = function(T)
{
  var _this = this;
  var deps = getArgs(T).map(function(d) { return _this.make(d); });
  return callNew(T, deps);
};

/**
 * Resolve the name of a dep
 * @param {String} name The dep name.
 * @return {{type: Function, deps: Array.<String>}} Type T.
 * @private
 */
Container.prototype._resolve = function(name)
{
  var info = this._types[name];
  if (!info)
    throw new Error(
      'Cannot resolve dependency "' + name + '"');
  return info;
};
