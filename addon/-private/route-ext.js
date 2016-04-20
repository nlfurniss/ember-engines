import Ember from 'ember';
import emberRequire from './ext-require';

const {
  get,
  Route,
  getOwner,
  Error: EmberError
} = Ember;

const assign = emberRequire('ember-metal/assign');
const emberA = emberRequire('ember-runtime/system/native_array', 'A');

/*
  Returns an arguments array where the route name arg is prefixed based on the mount point
*/
function prefixRouteNameArg(...args) {
  let routeName = args[0];
  let owner = getOwner(this);
  let prefix = owner.mountPoint;

  // only alter the routeName if it's actually referencing a route.
  if (owner.routable && typeof routeName === 'string') {
    if (resemblesURL(routeName)) {
      throw new EmberError('Route#transitionTo cannot be used for URLs. Please use the route name instead.');
    } else {
      routeName = `${prefix}.${routeName}`;
      args[0] = routeName;
    }
  }

  return args;
}

Route.reopen({
  paramsFor(name) {
    let owner = getOwner(this);
    let route = owner.lookup(`route:${name}`);

    if (!route) {
      return {};
    }

    var transition = this.router.router.activeTransition;
    var state = transition ? transition.state : this.router.router.state;

    var params = {};

    // ---- begin: customization for routable engines
    let fullName = name;
    if (owner.routable) {
      let prefix = owner.mountPoint;

      fullName = `${prefix}.${fullName}`;
    }
    assign(params, state.params[fullName]);
    // --- end: customization for routable engines

    assign(params, getQueryParamsFor(route, state));

    return params;
  },

  replaceWith(...args) {
    return this._super.apply(this, (prefixRouteNameArg.call(this, ...args)));
  },

  transitionTo(...args) {
    return this._super.apply(this, (prefixRouteNameArg.call(this, ...args)));
  },

  modelFor(_routeName, ...args) {
    let routeName = _routeName;
    let owner = getOwner(this);

    if (owner.routable) {
      let prefix = owner.mountPoint;
      if (routeName === 'application') {
        routeName = prefix;
      } else {
        routeName = `${prefix}.${_routeName}`;
      }
    }

    return this._super(routeName, ...args);
  }
});

// Cloned private function required to check if a routeName resembles a url instead
function resemblesURL(str) {
  return typeof str === 'string' && ( str === '' || str.charAt(0) === '/');
}

// Cloned private function required to support `paramsFor` override
function getFullQueryParams(router, state) {
  if (state.fullQueryParams) { return state.fullQueryParams; }

  state.fullQueryParams = {};
  assign(state.fullQueryParams, state.queryParams);

  var targetRouteName = state.handlerInfos[state.handlerInfos.length - 1].name;
  router._deserializeQueryParams(targetRouteName, state.fullQueryParams);
  return state.fullQueryParams;
}

// Cloned private function required to support `paramsFor` override
function getQueryParamsFor(route, state) {
  state.queryParamsFor = state.queryParamsFor || {};
  var name = route.routeName;

  if (state.queryParamsFor[name]) { return state.queryParamsFor[name]; }

  var fullQueryParams = getFullQueryParams(route.router, state);

  var params = state.queryParamsFor[name] = {};

  // Copy over all the query params for this route/controller into params hash.
  var qpMeta = get(route, '_qp');
  var qps = qpMeta.qps;
  for (var i = 0, len = qps.length; i < len; ++i) {
    // Put deserialized qp on params hash.
    var qp = qps[i];

    var qpValueWasPassedIn = (qp.prop in fullQueryParams);
    params[qp.prop] = qpValueWasPassedIn ?
                      fullQueryParams[qp.prop] :
                      copyDefaultValue(qp.defaultValue);
  }

  return params;
}

// Cloned private function required to support `paramsFor` override
function copyDefaultValue(value) {
  if (Array.isArray(value)) {
    return emberA(value.slice());
  }
  return value;
}
