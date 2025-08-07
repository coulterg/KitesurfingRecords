
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append$1(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text$1(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text$1(' ');
    }
    function empty() {
        return text$1('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append$1(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var EOL = {},
        EOF = {},
        QUOTE = 34,
        NEWLINE = 10,
        RETURN = 13;

    function objectConverter(columns) {
      return new Function("d", "return {" + columns.map(function(name, i) {
        return JSON.stringify(name) + ": d[" + i + "] || \"\"";
      }).join(",") + "}");
    }

    function customConverter(columns, f) {
      var object = objectConverter(columns);
      return function(row, i) {
        return f(object(row), i, columns);
      };
    }

    // Compute unique columns in order of discovery.
    function inferColumns(rows) {
      var columnSet = Object.create(null),
          columns = [];

      rows.forEach(function(row) {
        for (var column in row) {
          if (!(column in columnSet)) {
            columns.push(columnSet[column] = column);
          }
        }
      });

      return columns;
    }

    function pad$1(value, width) {
      var s = value + "", length = s.length;
      return length < width ? new Array(width - length + 1).join(0) + s : s;
    }

    function formatYear$1(year) {
      return year < 0 ? "-" + pad$1(-year, 6)
        : year > 9999 ? "+" + pad$1(year, 6)
        : pad$1(year, 4);
    }

    function formatDate(date) {
      var hours = date.getUTCHours(),
          minutes = date.getUTCMinutes(),
          seconds = date.getUTCSeconds(),
          milliseconds = date.getUTCMilliseconds();
      return isNaN(date) ? "Invalid Date"
          : formatYear$1(date.getUTCFullYear()) + "-" + pad$1(date.getUTCMonth() + 1, 2) + "-" + pad$1(date.getUTCDate(), 2)
          + (milliseconds ? "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + ":" + pad$1(seconds, 2) + "." + pad$1(milliseconds, 3) + "Z"
          : seconds ? "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + ":" + pad$1(seconds, 2) + "Z"
          : minutes || hours ? "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + "Z"
          : "");
    }

    function dsvFormat(delimiter) {
      var reFormat = new RegExp("[\"" + delimiter + "\n\r]"),
          DELIMITER = delimiter.charCodeAt(0);

      function parse(text, f) {
        var convert, columns, rows = parseRows(text, function(row, i) {
          if (convert) return convert(row, i - 1);
          columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
        });
        rows.columns = columns || [];
        return rows;
      }

      function parseRows(text, f) {
        var rows = [], // output rows
            N = text.length,
            I = 0, // current character index
            n = 0, // current line number
            t, // current token
            eof = N <= 0, // current token followed by EOF?
            eol = false; // current token followed by EOL?

        // Strip the trailing newline.
        if (text.charCodeAt(N - 1) === NEWLINE) --N;
        if (text.charCodeAt(N - 1) === RETURN) --N;

        function token() {
          if (eof) return EOF;
          if (eol) return eol = false, EOL;

          // Unescape quotes.
          var i, j = I, c;
          if (text.charCodeAt(j) === QUOTE) {
            while (I++ < N && text.charCodeAt(I) !== QUOTE || text.charCodeAt(++I) === QUOTE);
            if ((i = I) >= N) eof = true;
            else if ((c = text.charCodeAt(I++)) === NEWLINE) eol = true;
            else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
            return text.slice(j + 1, i - 1).replace(/""/g, "\"");
          }

          // Find next delimiter or newline.
          while (I < N) {
            if ((c = text.charCodeAt(i = I++)) === NEWLINE) eol = true;
            else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
            else if (c !== DELIMITER) continue;
            return text.slice(j, i);
          }

          // Return last token before EOF.
          return eof = true, text.slice(j, N);
        }

        while ((t = token()) !== EOF) {
          var row = [];
          while (t !== EOL && t !== EOF) row.push(t), t = token();
          if (f && (row = f(row, n++)) == null) continue;
          rows.push(row);
        }

        return rows;
      }

      function preformatBody(rows, columns) {
        return rows.map(function(row) {
          return columns.map(function(column) {
            return formatValue(row[column]);
          }).join(delimiter);
        });
      }

      function format(rows, columns) {
        if (columns == null) columns = inferColumns(rows);
        return [columns.map(formatValue).join(delimiter)].concat(preformatBody(rows, columns)).join("\n");
      }

      function formatBody(rows, columns) {
        if (columns == null) columns = inferColumns(rows);
        return preformatBody(rows, columns).join("\n");
      }

      function formatRows(rows) {
        return rows.map(formatRow).join("\n");
      }

      function formatRow(row) {
        return row.map(formatValue).join(delimiter);
      }

      function formatValue(value) {
        return value == null ? ""
            : value instanceof Date ? formatDate(value)
            : reFormat.test(value += "") ? "\"" + value.replace(/"/g, "\"\"") + "\""
            : value;
      }

      return {
        parse: parse,
        parseRows: parseRows,
        format: format,
        formatBody: formatBody,
        formatRows: formatRows,
        formatRow: formatRow,
        formatValue: formatValue
      };
    }

    var csv$1 = dsvFormat(",");

    var csvParse = csv$1.parse;

    function responseText(response) {
      if (!response.ok) throw new Error(response.status + " " + response.statusText);
      return response.text();
    }

    function text(input, init) {
      return fetch(input, init).then(responseText);
    }

    function dsvParse(parse) {
      return function(input, init, row) {
        if (arguments.length === 2 && typeof init === "function") row = init, init = undefined;
        return text(input, init).then(function(response) {
          return parse(response, row);
        });
      };
    }

    var csv = dsvParse(csvParse);

    const t0 = new Date, t1 = new Date;

    function timeInterval(floori, offseti, count, field) {

      function interval(date) {
        return floori(date = arguments.length === 0 ? new Date : new Date(+date)), date;
      }

      interval.floor = (date) => {
        return floori(date = new Date(+date)), date;
      };

      interval.ceil = (date) => {
        return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
      };

      interval.round = (date) => {
        const d0 = interval(date), d1 = interval.ceil(date);
        return date - d0 < d1 - date ? d0 : d1;
      };

      interval.offset = (date, step) => {
        return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
      };

      interval.range = (start, stop, step) => {
        const range = [];
        start = interval.ceil(start);
        step = step == null ? 1 : Math.floor(step);
        if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
        let previous;
        do range.push(previous = new Date(+start)), offseti(start, step), floori(start);
        while (previous < start && start < stop);
        return range;
      };

      interval.filter = (test) => {
        return timeInterval((date) => {
          if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
        }, (date, step) => {
          if (date >= date) {
            if (step < 0) while (++step <= 0) {
              while (offseti(date, -1), !test(date)) {} // eslint-disable-line no-empty
            } else while (--step >= 0) {
              while (offseti(date, +1), !test(date)) {} // eslint-disable-line no-empty
            }
          }
        });
      };

      if (count) {
        interval.count = (start, end) => {
          t0.setTime(+start), t1.setTime(+end);
          floori(t0), floori(t1);
          return Math.floor(count(t0, t1));
        };

        interval.every = (step) => {
          step = Math.floor(step);
          return !isFinite(step) || !(step > 0) ? null
              : !(step > 1) ? interval
              : interval.filter(field
                  ? (d) => field(d) % step === 0
                  : (d) => interval.count(0, d) % step === 0);
        };
      }

      return interval;
    }

    const durationSecond = 1000;
    const durationMinute = durationSecond * 60;
    const durationHour = durationMinute * 60;
    const durationDay = durationHour * 24;
    const durationWeek = durationDay * 7;

    const timeDay = timeInterval(
      date => date.setHours(0, 0, 0, 0),
      (date, step) => date.setDate(date.getDate() + step),
      (start, end) => (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay,
      date => date.getDate() - 1
    );

    timeDay.range;

    const utcDay = timeInterval((date) => {
      date.setUTCHours(0, 0, 0, 0);
    }, (date, step) => {
      date.setUTCDate(date.getUTCDate() + step);
    }, (start, end) => {
      return (end - start) / durationDay;
    }, (date) => {
      return date.getUTCDate() - 1;
    });

    utcDay.range;

    const unixDay = timeInterval((date) => {
      date.setUTCHours(0, 0, 0, 0);
    }, (date, step) => {
      date.setUTCDate(date.getUTCDate() + step);
    }, (start, end) => {
      return (end - start) / durationDay;
    }, (date) => {
      return Math.floor(date / durationDay);
    });

    unixDay.range;

    function timeWeekday(i) {
      return timeInterval((date) => {
        date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
        date.setHours(0, 0, 0, 0);
      }, (date, step) => {
        date.setDate(date.getDate() + step * 7);
      }, (start, end) => {
        return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
      });
    }

    const timeSunday = timeWeekday(0);
    const timeMonday = timeWeekday(1);
    const timeTuesday = timeWeekday(2);
    const timeWednesday = timeWeekday(3);
    const timeThursday = timeWeekday(4);
    const timeFriday = timeWeekday(5);
    const timeSaturday = timeWeekday(6);

    timeSunday.range;
    timeMonday.range;
    timeTuesday.range;
    timeWednesday.range;
    timeThursday.range;
    timeFriday.range;
    timeSaturday.range;

    function utcWeekday(i) {
      return timeInterval((date) => {
        date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
        date.setUTCHours(0, 0, 0, 0);
      }, (date, step) => {
        date.setUTCDate(date.getUTCDate() + step * 7);
      }, (start, end) => {
        return (end - start) / durationWeek;
      });
    }

    const utcSunday = utcWeekday(0);
    const utcMonday = utcWeekday(1);
    const utcTuesday = utcWeekday(2);
    const utcWednesday = utcWeekday(3);
    const utcThursday = utcWeekday(4);
    const utcFriday = utcWeekday(5);
    const utcSaturday = utcWeekday(6);

    utcSunday.range;
    utcMonday.range;
    utcTuesday.range;
    utcWednesday.range;
    utcThursday.range;
    utcFriday.range;
    utcSaturday.range;

    const timeMonth = timeInterval((date) => {
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
    }, (date, step) => {
      date.setMonth(date.getMonth() + step);
    }, (start, end) => {
      return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
    }, (date) => {
      return date.getMonth();
    });

    const timeMonths = timeMonth.range;

    const utcMonth = timeInterval((date) => {
      date.setUTCDate(1);
      date.setUTCHours(0, 0, 0, 0);
    }, (date, step) => {
      date.setUTCMonth(date.getUTCMonth() + step);
    }, (start, end) => {
      return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
    }, (date) => {
      return date.getUTCMonth();
    });

    utcMonth.range;

    const timeYear = timeInterval((date) => {
      date.setMonth(0, 1);
      date.setHours(0, 0, 0, 0);
    }, (date, step) => {
      date.setFullYear(date.getFullYear() + step);
    }, (start, end) => {
      return end.getFullYear() - start.getFullYear();
    }, (date) => {
      return date.getFullYear();
    });

    // An optimized implementation for this simple case.
    timeYear.every = (k) => {
      return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date) => {
        date.setFullYear(Math.floor(date.getFullYear() / k) * k);
        date.setMonth(0, 1);
        date.setHours(0, 0, 0, 0);
      }, (date, step) => {
        date.setFullYear(date.getFullYear() + step * k);
      });
    };

    timeYear.range;

    const utcYear = timeInterval((date) => {
      date.setUTCMonth(0, 1);
      date.setUTCHours(0, 0, 0, 0);
    }, (date, step) => {
      date.setUTCFullYear(date.getUTCFullYear() + step);
    }, (start, end) => {
      return end.getUTCFullYear() - start.getUTCFullYear();
    }, (date) => {
      return date.getUTCFullYear();
    });

    // An optimized implementation for this simple case.
    utcYear.every = (k) => {
      return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date) => {
        date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
        date.setUTCMonth(0, 1);
        date.setUTCHours(0, 0, 0, 0);
      }, (date, step) => {
        date.setUTCFullYear(date.getUTCFullYear() + step * k);
      });
    };

    utcYear.range;

    function ascending(a, b) {
      return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
    }

    function descending(a, b) {
      return a == null || b == null ? NaN
        : b < a ? -1
        : b > a ? 1
        : b >= a ? 0
        : NaN;
    }

    function bisector(f) {
      let compare1, compare2, delta;

      // If an accessor is specified, promote it to a comparator. In this case we
      // can test whether the search value is (self-) comparable. We can’t do this
      // for a comparator (except for specific, known comparators) because we can’t
      // tell if the comparator is symmetric, and an asymmetric comparator can’t be
      // used to test whether a single value is comparable.
      if (f.length !== 2) {
        compare1 = ascending;
        compare2 = (d, x) => ascending(f(d), x);
        delta = (d, x) => f(d) - x;
      } else {
        compare1 = f === ascending || f === descending ? f : zero$1;
        compare2 = f;
        delta = f;
      }

      function left(a, x, lo = 0, hi = a.length) {
        if (lo < hi) {
          if (compare1(x, x) !== 0) return hi;
          do {
            const mid = (lo + hi) >>> 1;
            if (compare2(a[mid], x) < 0) lo = mid + 1;
            else hi = mid;
          } while (lo < hi);
        }
        return lo;
      }

      function right(a, x, lo = 0, hi = a.length) {
        if (lo < hi) {
          if (compare1(x, x) !== 0) return hi;
          do {
            const mid = (lo + hi) >>> 1;
            if (compare2(a[mid], x) <= 0) lo = mid + 1;
            else hi = mid;
          } while (lo < hi);
        }
        return lo;
      }

      function center(a, x, lo = 0, hi = a.length) {
        const i = left(a, x, lo, hi - 1);
        return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
      }

      return {left, center, right};
    }

    function zero$1() {
      return 0;
    }

    function number$1(x) {
      return x === null ? NaN : +x;
    }

    const ascendingBisect = bisector(ascending);
    const bisectRight = ascendingBisect.right;
    bisector(number$1).center;
    var bisect = bisectRight;

    const e10 = Math.sqrt(50),
        e5 = Math.sqrt(10),
        e2 = Math.sqrt(2);

    function tickSpec(start, stop, count) {
      const step = (stop - start) / Math.max(0, count),
          power = Math.floor(Math.log10(step)),
          error = step / Math.pow(10, power),
          factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
      let i1, i2, inc;
      if (power < 0) {
        inc = Math.pow(10, -power) / factor;
        i1 = Math.round(start * inc);
        i2 = Math.round(stop * inc);
        if (i1 / inc < start) ++i1;
        if (i2 / inc > stop) --i2;
        inc = -inc;
      } else {
        inc = Math.pow(10, power) * factor;
        i1 = Math.round(start / inc);
        i2 = Math.round(stop / inc);
        if (i1 * inc < start) ++i1;
        if (i2 * inc > stop) --i2;
      }
      if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start, stop, count * 2);
      return [i1, i2, inc];
    }

    function ticks(start, stop, count) {
      stop = +stop, start = +start, count = +count;
      if (!(count > 0)) return [];
      if (start === stop) return [start];
      const reverse = stop < start, [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
      if (!(i2 >= i1)) return [];
      const n = i2 - i1 + 1, ticks = new Array(n);
      if (reverse) {
        if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) / -inc;
        else for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) * inc;
      } else {
        if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) / -inc;
        else for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) * inc;
      }
      return ticks;
    }

    function tickIncrement(start, stop, count) {
      stop = +stop, start = +start, count = +count;
      return tickSpec(start, stop, count)[2];
    }

    function tickStep(start, stop, count) {
      stop = +stop, start = +start, count = +count;
      const reverse = stop < start, inc = reverse ? tickIncrement(stop, start, count) : tickIncrement(start, stop, count);
      return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
    }

    function max$1(values, valueof) {
      let max;
      if (valueof === undefined) {
        for (const value of values) {
          if (value != null
              && (max < value || (max === undefined && value >= value))) {
            max = value;
          }
        }
      } else {
        let index = -1;
        for (let value of values) {
          if ((value = valueof(value, ++index, values)) != null
              && (max < value || (max === undefined && value >= value))) {
            max = value;
          }
        }
      }
      return max;
    }

    function range(start, stop, step) {
      start = +start, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start, start = 0, 1) : n < 3 ? 1 : +step;

      var i = -1,
          n = Math.max(0, Math.ceil((stop - start) / step)) | 0,
          range = new Array(n);

      while (++i < n) {
        range[i] = start + i * step;
      }

      return range;
    }

    function localDate(d) {
      if (0 <= d.y && d.y < 100) {
        var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
        date.setFullYear(d.y);
        return date;
      }
      return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
    }

    function utcDate(d) {
      if (0 <= d.y && d.y < 100) {
        var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
        date.setUTCFullYear(d.y);
        return date;
      }
      return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
    }

    function newDate(y, m, d) {
      return {y: y, m: m, d: d, H: 0, M: 0, S: 0, L: 0};
    }

    function formatLocale$1(locale) {
      var locale_dateTime = locale.dateTime,
          locale_date = locale.date,
          locale_time = locale.time,
          locale_periods = locale.periods,
          locale_weekdays = locale.days,
          locale_shortWeekdays = locale.shortDays,
          locale_months = locale.months,
          locale_shortMonths = locale.shortMonths;

      var periodRe = formatRe(locale_periods),
          periodLookup = formatLookup(locale_periods),
          weekdayRe = formatRe(locale_weekdays),
          weekdayLookup = formatLookup(locale_weekdays),
          shortWeekdayRe = formatRe(locale_shortWeekdays),
          shortWeekdayLookup = formatLookup(locale_shortWeekdays),
          monthRe = formatRe(locale_months),
          monthLookup = formatLookup(locale_months),
          shortMonthRe = formatRe(locale_shortMonths),
          shortMonthLookup = formatLookup(locale_shortMonths);

      var formats = {
        "a": formatShortWeekday,
        "A": formatWeekday,
        "b": formatShortMonth,
        "B": formatMonth,
        "c": null,
        "d": formatDayOfMonth,
        "e": formatDayOfMonth,
        "f": formatMicroseconds,
        "g": formatYearISO,
        "G": formatFullYearISO,
        "H": formatHour24,
        "I": formatHour12,
        "j": formatDayOfYear,
        "L": formatMilliseconds,
        "m": formatMonthNumber,
        "M": formatMinutes,
        "p": formatPeriod,
        "q": formatQuarter,
        "Q": formatUnixTimestamp,
        "s": formatUnixTimestampSeconds,
        "S": formatSeconds,
        "u": formatWeekdayNumberMonday,
        "U": formatWeekNumberSunday,
        "V": formatWeekNumberISO,
        "w": formatWeekdayNumberSunday,
        "W": formatWeekNumberMonday,
        "x": null,
        "X": null,
        "y": formatYear,
        "Y": formatFullYear,
        "Z": formatZone,
        "%": formatLiteralPercent
      };

      var utcFormats = {
        "a": formatUTCShortWeekday,
        "A": formatUTCWeekday,
        "b": formatUTCShortMonth,
        "B": formatUTCMonth,
        "c": null,
        "d": formatUTCDayOfMonth,
        "e": formatUTCDayOfMonth,
        "f": formatUTCMicroseconds,
        "g": formatUTCYearISO,
        "G": formatUTCFullYearISO,
        "H": formatUTCHour24,
        "I": formatUTCHour12,
        "j": formatUTCDayOfYear,
        "L": formatUTCMilliseconds,
        "m": formatUTCMonthNumber,
        "M": formatUTCMinutes,
        "p": formatUTCPeriod,
        "q": formatUTCQuarter,
        "Q": formatUnixTimestamp,
        "s": formatUnixTimestampSeconds,
        "S": formatUTCSeconds,
        "u": formatUTCWeekdayNumberMonday,
        "U": formatUTCWeekNumberSunday,
        "V": formatUTCWeekNumberISO,
        "w": formatUTCWeekdayNumberSunday,
        "W": formatUTCWeekNumberMonday,
        "x": null,
        "X": null,
        "y": formatUTCYear,
        "Y": formatUTCFullYear,
        "Z": formatUTCZone,
        "%": formatLiteralPercent
      };

      var parses = {
        "a": parseShortWeekday,
        "A": parseWeekday,
        "b": parseShortMonth,
        "B": parseMonth,
        "c": parseLocaleDateTime,
        "d": parseDayOfMonth,
        "e": parseDayOfMonth,
        "f": parseMicroseconds,
        "g": parseYear,
        "G": parseFullYear,
        "H": parseHour24,
        "I": parseHour24,
        "j": parseDayOfYear,
        "L": parseMilliseconds,
        "m": parseMonthNumber,
        "M": parseMinutes,
        "p": parsePeriod,
        "q": parseQuarter,
        "Q": parseUnixTimestamp,
        "s": parseUnixTimestampSeconds,
        "S": parseSeconds,
        "u": parseWeekdayNumberMonday,
        "U": parseWeekNumberSunday,
        "V": parseWeekNumberISO,
        "w": parseWeekdayNumberSunday,
        "W": parseWeekNumberMonday,
        "x": parseLocaleDate,
        "X": parseLocaleTime,
        "y": parseYear,
        "Y": parseFullYear,
        "Z": parseZone,
        "%": parseLiteralPercent
      };

      // These recursive directive definitions must be deferred.
      formats.x = newFormat(locale_date, formats);
      formats.X = newFormat(locale_time, formats);
      formats.c = newFormat(locale_dateTime, formats);
      utcFormats.x = newFormat(locale_date, utcFormats);
      utcFormats.X = newFormat(locale_time, utcFormats);
      utcFormats.c = newFormat(locale_dateTime, utcFormats);

      function newFormat(specifier, formats) {
        return function(date) {
          var string = [],
              i = -1,
              j = 0,
              n = specifier.length,
              c,
              pad,
              format;

          if (!(date instanceof Date)) date = new Date(+date);

          while (++i < n) {
            if (specifier.charCodeAt(i) === 37) {
              string.push(specifier.slice(j, i));
              if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
              else pad = c === "e" ? " " : "0";
              if (format = formats[c]) c = format(date, pad);
              string.push(c);
              j = i + 1;
            }
          }

          string.push(specifier.slice(j, i));
          return string.join("");
        };
      }

      function newParse(specifier, Z) {
        return function(string) {
          var d = newDate(1900, undefined, 1),
              i = parseSpecifier(d, specifier, string += "", 0),
              week, day;
          if (i != string.length) return null;

          // If a UNIX timestamp is specified, return it.
          if ("Q" in d) return new Date(d.Q);
          if ("s" in d) return new Date(d.s * 1000 + ("L" in d ? d.L : 0));

          // If this is utcParse, never use the local timezone.
          if (Z && !("Z" in d)) d.Z = 0;

          // The am-pm flag is 0 for AM, and 1 for PM.
          if ("p" in d) d.H = d.H % 12 + d.p * 12;

          // If the month was not specified, inherit from the quarter.
          if (d.m === undefined) d.m = "q" in d ? d.q : 0;

          // Convert day-of-week and week-of-year to day-of-year.
          if ("V" in d) {
            if (d.V < 1 || d.V > 53) return null;
            if (!("w" in d)) d.w = 1;
            if ("Z" in d) {
              week = utcDate(newDate(d.y, 0, 1)), day = week.getUTCDay();
              week = day > 4 || day === 0 ? utcMonday.ceil(week) : utcMonday(week);
              week = utcDay.offset(week, (d.V - 1) * 7);
              d.y = week.getUTCFullYear();
              d.m = week.getUTCMonth();
              d.d = week.getUTCDate() + (d.w + 6) % 7;
            } else {
              week = localDate(newDate(d.y, 0, 1)), day = week.getDay();
              week = day > 4 || day === 0 ? timeMonday.ceil(week) : timeMonday(week);
              week = timeDay.offset(week, (d.V - 1) * 7);
              d.y = week.getFullYear();
              d.m = week.getMonth();
              d.d = week.getDate() + (d.w + 6) % 7;
            }
          } else if ("W" in d || "U" in d) {
            if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
            day = "Z" in d ? utcDate(newDate(d.y, 0, 1)).getUTCDay() : localDate(newDate(d.y, 0, 1)).getDay();
            d.m = 0;
            d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day + 5) % 7 : d.w + d.U * 7 - (day + 6) % 7;
          }

          // If a time zone is specified, all fields are interpreted as UTC and then
          // offset according to the specified time zone.
          if ("Z" in d) {
            d.H += d.Z / 100 | 0;
            d.M += d.Z % 100;
            return utcDate(d);
          }

          // Otherwise, all fields are in local time.
          return localDate(d);
        };
      }

      function parseSpecifier(d, specifier, string, j) {
        var i = 0,
            n = specifier.length,
            m = string.length,
            c,
            parse;

        while (i < n) {
          if (j >= m) return -1;
          c = specifier.charCodeAt(i++);
          if (c === 37) {
            c = specifier.charAt(i++);
            parse = parses[c in pads ? specifier.charAt(i++) : c];
            if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
          } else if (c != string.charCodeAt(j++)) {
            return -1;
          }
        }

        return j;
      }

      function parsePeriod(d, string, i) {
        var n = periodRe.exec(string.slice(i));
        return n ? (d.p = periodLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
      }

      function parseShortWeekday(d, string, i) {
        var n = shortWeekdayRe.exec(string.slice(i));
        return n ? (d.w = shortWeekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
      }

      function parseWeekday(d, string, i) {
        var n = weekdayRe.exec(string.slice(i));
        return n ? (d.w = weekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
      }

      function parseShortMonth(d, string, i) {
        var n = shortMonthRe.exec(string.slice(i));
        return n ? (d.m = shortMonthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
      }

      function parseMonth(d, string, i) {
        var n = monthRe.exec(string.slice(i));
        return n ? (d.m = monthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
      }

      function parseLocaleDateTime(d, string, i) {
        return parseSpecifier(d, locale_dateTime, string, i);
      }

      function parseLocaleDate(d, string, i) {
        return parseSpecifier(d, locale_date, string, i);
      }

      function parseLocaleTime(d, string, i) {
        return parseSpecifier(d, locale_time, string, i);
      }

      function formatShortWeekday(d) {
        return locale_shortWeekdays[d.getDay()];
      }

      function formatWeekday(d) {
        return locale_weekdays[d.getDay()];
      }

      function formatShortMonth(d) {
        return locale_shortMonths[d.getMonth()];
      }

      function formatMonth(d) {
        return locale_months[d.getMonth()];
      }

      function formatPeriod(d) {
        return locale_periods[+(d.getHours() >= 12)];
      }

      function formatQuarter(d) {
        return 1 + ~~(d.getMonth() / 3);
      }

      function formatUTCShortWeekday(d) {
        return locale_shortWeekdays[d.getUTCDay()];
      }

      function formatUTCWeekday(d) {
        return locale_weekdays[d.getUTCDay()];
      }

      function formatUTCShortMonth(d) {
        return locale_shortMonths[d.getUTCMonth()];
      }

      function formatUTCMonth(d) {
        return locale_months[d.getUTCMonth()];
      }

      function formatUTCPeriod(d) {
        return locale_periods[+(d.getUTCHours() >= 12)];
      }

      function formatUTCQuarter(d) {
        return 1 + ~~(d.getUTCMonth() / 3);
      }

      return {
        format: function(specifier) {
          var f = newFormat(specifier += "", formats);
          f.toString = function() { return specifier; };
          return f;
        },
        parse: function(specifier) {
          var p = newParse(specifier += "", false);
          p.toString = function() { return specifier; };
          return p;
        },
        utcFormat: function(specifier) {
          var f = newFormat(specifier += "", utcFormats);
          f.toString = function() { return specifier; };
          return f;
        },
        utcParse: function(specifier) {
          var p = newParse(specifier += "", true);
          p.toString = function() { return specifier; };
          return p;
        }
      };
    }

    var pads = {"-": "", "_": " ", "0": "0"},
        numberRe = /^\s*\d+/, // note: ignores next directive
        percentRe = /^%/,
        requoteRe = /[\\^$*+?|[\]().{}]/g;

    function pad(value, fill, width) {
      var sign = value < 0 ? "-" : "",
          string = (sign ? -value : value) + "",
          length = string.length;
      return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
    }

    function requote(s) {
      return s.replace(requoteRe, "\\$&");
    }

    function formatRe(names) {
      return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
    }

    function formatLookup(names) {
      return new Map(names.map((name, i) => [name.toLowerCase(), i]));
    }

    function parseWeekdayNumberSunday(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 1));
      return n ? (d.w = +n[0], i + n[0].length) : -1;
    }

    function parseWeekdayNumberMonday(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 1));
      return n ? (d.u = +n[0], i + n[0].length) : -1;
    }

    function parseWeekNumberSunday(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.U = +n[0], i + n[0].length) : -1;
    }

    function parseWeekNumberISO(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.V = +n[0], i + n[0].length) : -1;
    }

    function parseWeekNumberMonday(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.W = +n[0], i + n[0].length) : -1;
    }

    function parseFullYear(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 4));
      return n ? (d.y = +n[0], i + n[0].length) : -1;
    }

    function parseYear(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
    }

    function parseZone(d, string, i) {
      var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
      return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
    }

    function parseQuarter(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 1));
      return n ? (d.q = n[0] * 3 - 3, i + n[0].length) : -1;
    }

    function parseMonthNumber(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
    }

    function parseDayOfMonth(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.d = +n[0], i + n[0].length) : -1;
    }

    function parseDayOfYear(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 3));
      return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
    }

    function parseHour24(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.H = +n[0], i + n[0].length) : -1;
    }

    function parseMinutes(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.M = +n[0], i + n[0].length) : -1;
    }

    function parseSeconds(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.S = +n[0], i + n[0].length) : -1;
    }

    function parseMilliseconds(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 3));
      return n ? (d.L = +n[0], i + n[0].length) : -1;
    }

    function parseMicroseconds(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 6));
      return n ? (d.L = Math.floor(n[0] / 1000), i + n[0].length) : -1;
    }

    function parseLiteralPercent(d, string, i) {
      var n = percentRe.exec(string.slice(i, i + 1));
      return n ? i + n[0].length : -1;
    }

    function parseUnixTimestamp(d, string, i) {
      var n = numberRe.exec(string.slice(i));
      return n ? (d.Q = +n[0], i + n[0].length) : -1;
    }

    function parseUnixTimestampSeconds(d, string, i) {
      var n = numberRe.exec(string.slice(i));
      return n ? (d.s = +n[0], i + n[0].length) : -1;
    }

    function formatDayOfMonth(d, p) {
      return pad(d.getDate(), p, 2);
    }

    function formatHour24(d, p) {
      return pad(d.getHours(), p, 2);
    }

    function formatHour12(d, p) {
      return pad(d.getHours() % 12 || 12, p, 2);
    }

    function formatDayOfYear(d, p) {
      return pad(1 + timeDay.count(timeYear(d), d), p, 3);
    }

    function formatMilliseconds(d, p) {
      return pad(d.getMilliseconds(), p, 3);
    }

    function formatMicroseconds(d, p) {
      return formatMilliseconds(d, p) + "000";
    }

    function formatMonthNumber(d, p) {
      return pad(d.getMonth() + 1, p, 2);
    }

    function formatMinutes(d, p) {
      return pad(d.getMinutes(), p, 2);
    }

    function formatSeconds(d, p) {
      return pad(d.getSeconds(), p, 2);
    }

    function formatWeekdayNumberMonday(d) {
      var day = d.getDay();
      return day === 0 ? 7 : day;
    }

    function formatWeekNumberSunday(d, p) {
      return pad(timeSunday.count(timeYear(d) - 1, d), p, 2);
    }

    function dISO(d) {
      var day = d.getDay();
      return (day >= 4 || day === 0) ? timeThursday(d) : timeThursday.ceil(d);
    }

    function formatWeekNumberISO(d, p) {
      d = dISO(d);
      return pad(timeThursday.count(timeYear(d), d) + (timeYear(d).getDay() === 4), p, 2);
    }

    function formatWeekdayNumberSunday(d) {
      return d.getDay();
    }

    function formatWeekNumberMonday(d, p) {
      return pad(timeMonday.count(timeYear(d) - 1, d), p, 2);
    }

    function formatYear(d, p) {
      return pad(d.getFullYear() % 100, p, 2);
    }

    function formatYearISO(d, p) {
      d = dISO(d);
      return pad(d.getFullYear() % 100, p, 2);
    }

    function formatFullYear(d, p) {
      return pad(d.getFullYear() % 10000, p, 4);
    }

    function formatFullYearISO(d, p) {
      var day = d.getDay();
      d = (day >= 4 || day === 0) ? timeThursday(d) : timeThursday.ceil(d);
      return pad(d.getFullYear() % 10000, p, 4);
    }

    function formatZone(d) {
      var z = d.getTimezoneOffset();
      return (z > 0 ? "-" : (z *= -1, "+"))
          + pad(z / 60 | 0, "0", 2)
          + pad(z % 60, "0", 2);
    }

    function formatUTCDayOfMonth(d, p) {
      return pad(d.getUTCDate(), p, 2);
    }

    function formatUTCHour24(d, p) {
      return pad(d.getUTCHours(), p, 2);
    }

    function formatUTCHour12(d, p) {
      return pad(d.getUTCHours() % 12 || 12, p, 2);
    }

    function formatUTCDayOfYear(d, p) {
      return pad(1 + utcDay.count(utcYear(d), d), p, 3);
    }

    function formatUTCMilliseconds(d, p) {
      return pad(d.getUTCMilliseconds(), p, 3);
    }

    function formatUTCMicroseconds(d, p) {
      return formatUTCMilliseconds(d, p) + "000";
    }

    function formatUTCMonthNumber(d, p) {
      return pad(d.getUTCMonth() + 1, p, 2);
    }

    function formatUTCMinutes(d, p) {
      return pad(d.getUTCMinutes(), p, 2);
    }

    function formatUTCSeconds(d, p) {
      return pad(d.getUTCSeconds(), p, 2);
    }

    function formatUTCWeekdayNumberMonday(d) {
      var dow = d.getUTCDay();
      return dow === 0 ? 7 : dow;
    }

    function formatUTCWeekNumberSunday(d, p) {
      return pad(utcSunday.count(utcYear(d) - 1, d), p, 2);
    }

    function UTCdISO(d) {
      var day = d.getUTCDay();
      return (day >= 4 || day === 0) ? utcThursday(d) : utcThursday.ceil(d);
    }

    function formatUTCWeekNumberISO(d, p) {
      d = UTCdISO(d);
      return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
    }

    function formatUTCWeekdayNumberSunday(d) {
      return d.getUTCDay();
    }

    function formatUTCWeekNumberMonday(d, p) {
      return pad(utcMonday.count(utcYear(d) - 1, d), p, 2);
    }

    function formatUTCYear(d, p) {
      return pad(d.getUTCFullYear() % 100, p, 2);
    }

    function formatUTCYearISO(d, p) {
      d = UTCdISO(d);
      return pad(d.getUTCFullYear() % 100, p, 2);
    }

    function formatUTCFullYear(d, p) {
      return pad(d.getUTCFullYear() % 10000, p, 4);
    }

    function formatUTCFullYearISO(d, p) {
      var day = d.getUTCDay();
      d = (day >= 4 || day === 0) ? utcThursday(d) : utcThursday.ceil(d);
      return pad(d.getUTCFullYear() % 10000, p, 4);
    }

    function formatUTCZone() {
      return "+0000";
    }

    function formatLiteralPercent() {
      return "%";
    }

    function formatUnixTimestamp(d) {
      return +d;
    }

    function formatUnixTimestampSeconds(d) {
      return Math.floor(+d / 1000);
    }

    var locale$1;
    var timeFormat;
    var timeParse;

    defaultLocale$1({
      dateTime: "%x, %X",
      date: "%-m/%-d/%Y",
      time: "%-I:%M:%S %p",
      periods: ["AM", "PM"],
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    });

    function defaultLocale$1(definition) {
      locale$1 = formatLocale$1(definition);
      timeFormat = locale$1.format;
      timeParse = locale$1.parse;
      locale$1.utcFormat;
      locale$1.utcParse;
      return locale$1;
    }

    function constant$1(x) {
      return function constant() {
        return x;
      };
    }

    const abs = Math.abs;
    const atan2 = Math.atan2;
    const cos = Math.cos;
    const max = Math.max;
    const min = Math.min;
    const sin = Math.sin;
    const sqrt = Math.sqrt;

    const epsilon$1 = 1e-12;
    const pi$1 = Math.PI;
    const halfPi = pi$1 / 2;
    const tau$1 = 2 * pi$1;

    function acos(x) {
      return x > 1 ? 0 : x < -1 ? pi$1 : Math.acos(x);
    }

    function asin(x) {
      return x >= 1 ? halfPi : x <= -1 ? -halfPi : Math.asin(x);
    }

    const pi = Math.PI,
        tau = 2 * pi,
        epsilon = 1e-6,
        tauEpsilon = tau - epsilon;

    function append(strings) {
      this._ += strings[0];
      for (let i = 1, n = strings.length; i < n; ++i) {
        this._ += arguments[i] + strings[i];
      }
    }

    function appendRound(digits) {
      let d = Math.floor(digits);
      if (!(d >= 0)) throw new Error(`invalid digits: ${digits}`);
      if (d > 15) return append;
      const k = 10 ** d;
      return function(strings) {
        this._ += strings[0];
        for (let i = 1, n = strings.length; i < n; ++i) {
          this._ += Math.round(arguments[i] * k) / k + strings[i];
        }
      };
    }

    class Path {
      constructor(digits) {
        this._x0 = this._y0 = // start of current subpath
        this._x1 = this._y1 = null; // end of current subpath
        this._ = "";
        this._append = digits == null ? append : appendRound(digits);
      }
      moveTo(x, y) {
        this._append`M${this._x0 = this._x1 = +x},${this._y0 = this._y1 = +y}`;
      }
      closePath() {
        if (this._x1 !== null) {
          this._x1 = this._x0, this._y1 = this._y0;
          this._append`Z`;
        }
      }
      lineTo(x, y) {
        this._append`L${this._x1 = +x},${this._y1 = +y}`;
      }
      quadraticCurveTo(x1, y1, x, y) {
        this._append`Q${+x1},${+y1},${this._x1 = +x},${this._y1 = +y}`;
      }
      bezierCurveTo(x1, y1, x2, y2, x, y) {
        this._append`C${+x1},${+y1},${+x2},${+y2},${this._x1 = +x},${this._y1 = +y}`;
      }
      arcTo(x1, y1, x2, y2, r) {
        x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;

        // Is the radius negative? Error.
        if (r < 0) throw new Error(`negative radius: ${r}`);

        let x0 = this._x1,
            y0 = this._y1,
            x21 = x2 - x1,
            y21 = y2 - y1,
            x01 = x0 - x1,
            y01 = y0 - y1,
            l01_2 = x01 * x01 + y01 * y01;

        // Is this path empty? Move to (x1,y1).
        if (this._x1 === null) {
          this._append`M${this._x1 = x1},${this._y1 = y1}`;
        }

        // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
        else if (!(l01_2 > epsilon));

        // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
        // Equivalently, is (x1,y1) coincident with (x2,y2)?
        // Or, is the radius zero? Line to (x1,y1).
        else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon) || !r) {
          this._append`L${this._x1 = x1},${this._y1 = y1}`;
        }

        // Otherwise, draw an arc!
        else {
          let x20 = x2 - x0,
              y20 = y2 - y0,
              l21_2 = x21 * x21 + y21 * y21,
              l20_2 = x20 * x20 + y20 * y20,
              l21 = Math.sqrt(l21_2),
              l01 = Math.sqrt(l01_2),
              l = r * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2),
              t01 = l / l01,
              t21 = l / l21;

          // If the start tangent is not coincident with (x0,y0), line to.
          if (Math.abs(t01 - 1) > epsilon) {
            this._append`L${x1 + t01 * x01},${y1 + t01 * y01}`;
          }

          this._append`A${r},${r},0,0,${+(y01 * x20 > x01 * y20)},${this._x1 = x1 + t21 * x21},${this._y1 = y1 + t21 * y21}`;
        }
      }
      arc(x, y, r, a0, a1, ccw) {
        x = +x, y = +y, r = +r, ccw = !!ccw;

        // Is the radius negative? Error.
        if (r < 0) throw new Error(`negative radius: ${r}`);

        let dx = r * Math.cos(a0),
            dy = r * Math.sin(a0),
            x0 = x + dx,
            y0 = y + dy,
            cw = 1 ^ ccw,
            da = ccw ? a0 - a1 : a1 - a0;

        // Is this path empty? Move to (x0,y0).
        if (this._x1 === null) {
          this._append`M${x0},${y0}`;
        }

        // Or, is (x0,y0) not coincident with the previous point? Line to (x0,y0).
        else if (Math.abs(this._x1 - x0) > epsilon || Math.abs(this._y1 - y0) > epsilon) {
          this._append`L${x0},${y0}`;
        }

        // Is this arc empty? We’re done.
        if (!r) return;

        // Does the angle go the wrong way? Flip the direction.
        if (da < 0) da = da % tau + tau;

        // Is this a complete circle? Draw two arcs to complete the circle.
        if (da > tauEpsilon) {
          this._append`A${r},${r},0,1,${cw},${x - dx},${y - dy}A${r},${r},0,1,${cw},${this._x1 = x0},${this._y1 = y0}`;
        }

        // Is this arc non-empty? Draw an arc!
        else if (da > epsilon) {
          this._append`A${r},${r},0,${+(da >= pi)},${cw},${this._x1 = x + r * Math.cos(a1)},${this._y1 = y + r * Math.sin(a1)}`;
        }
      }
      rect(x, y, w, h) {
        this._append`M${this._x0 = this._x1 = +x},${this._y0 = this._y1 = +y}h${w = +w}v${+h}h${-w}Z`;
      }
      toString() {
        return this._;
      }
    }

    function withPath(shape) {
      let digits = 3;

      shape.digits = function(_) {
        if (!arguments.length) return digits;
        if (_ == null) {
          digits = null;
        } else {
          const d = Math.floor(_);
          if (!(d >= 0)) throw new RangeError(`invalid digits: ${_}`);
          digits = d;
        }
        return shape;
      };

      return () => new Path(digits);
    }

    function arcInnerRadius(d) {
      return d.innerRadius;
    }

    function arcOuterRadius(d) {
      return d.outerRadius;
    }

    function arcStartAngle(d) {
      return d.startAngle;
    }

    function arcEndAngle(d) {
      return d.endAngle;
    }

    function arcPadAngle(d) {
      return d && d.padAngle; // Note: optional!
    }

    function intersect(x0, y0, x1, y1, x2, y2, x3, y3) {
      var x10 = x1 - x0, y10 = y1 - y0,
          x32 = x3 - x2, y32 = y3 - y2,
          t = y32 * x10 - x32 * y10;
      if (t * t < epsilon$1) return;
      t = (x32 * (y0 - y2) - y32 * (x0 - x2)) / t;
      return [x0 + t * x10, y0 + t * y10];
    }

    // Compute perpendicular offset line of length rc.
    // http://mathworld.wolfram.com/Circle-LineIntersection.html
    function cornerTangents(x0, y0, x1, y1, r1, rc, cw) {
      var x01 = x0 - x1,
          y01 = y0 - y1,
          lo = (cw ? rc : -rc) / sqrt(x01 * x01 + y01 * y01),
          ox = lo * y01,
          oy = -lo * x01,
          x11 = x0 + ox,
          y11 = y0 + oy,
          x10 = x1 + ox,
          y10 = y1 + oy,
          x00 = (x11 + x10) / 2,
          y00 = (y11 + y10) / 2,
          dx = x10 - x11,
          dy = y10 - y11,
          d2 = dx * dx + dy * dy,
          r = r1 - rc,
          D = x11 * y10 - x10 * y11,
          d = (dy < 0 ? -1 : 1) * sqrt(max(0, r * r * d2 - D * D)),
          cx0 = (D * dy - dx * d) / d2,
          cy0 = (-D * dx - dy * d) / d2,
          cx1 = (D * dy + dx * d) / d2,
          cy1 = (-D * dx + dy * d) / d2,
          dx0 = cx0 - x00,
          dy0 = cy0 - y00,
          dx1 = cx1 - x00,
          dy1 = cy1 - y00;

      // Pick the closer of the two intersection points.
      // TODO Is there a faster way to determine which intersection to use?
      if (dx0 * dx0 + dy0 * dy0 > dx1 * dx1 + dy1 * dy1) cx0 = cx1, cy0 = cy1;

      return {
        cx: cx0,
        cy: cy0,
        x01: -ox,
        y01: -oy,
        x11: cx0 * (r1 / r - 1),
        y11: cy0 * (r1 / r - 1)
      };
    }

    function arc() {
      var innerRadius = arcInnerRadius,
          outerRadius = arcOuterRadius,
          cornerRadius = constant$1(0),
          padRadius = null,
          startAngle = arcStartAngle,
          endAngle = arcEndAngle,
          padAngle = arcPadAngle,
          context = null,
          path = withPath(arc);

      function arc() {
        var buffer,
            r,
            r0 = +innerRadius.apply(this, arguments),
            r1 = +outerRadius.apply(this, arguments),
            a0 = startAngle.apply(this, arguments) - halfPi,
            a1 = endAngle.apply(this, arguments) - halfPi,
            da = abs(a1 - a0),
            cw = a1 > a0;

        if (!context) context = buffer = path();

        // Ensure that the outer radius is always larger than the inner radius.
        if (r1 < r0) r = r1, r1 = r0, r0 = r;

        // Is it a point?
        if (!(r1 > epsilon$1)) context.moveTo(0, 0);

        // Or is it a circle or annulus?
        else if (da > tau$1 - epsilon$1) {
          context.moveTo(r1 * cos(a0), r1 * sin(a0));
          context.arc(0, 0, r1, a0, a1, !cw);
          if (r0 > epsilon$1) {
            context.moveTo(r0 * cos(a1), r0 * sin(a1));
            context.arc(0, 0, r0, a1, a0, cw);
          }
        }

        // Or is it a circular or annular sector?
        else {
          var a01 = a0,
              a11 = a1,
              a00 = a0,
              a10 = a1,
              da0 = da,
              da1 = da,
              ap = padAngle.apply(this, arguments) / 2,
              rp = (ap > epsilon$1) && (padRadius ? +padRadius.apply(this, arguments) : sqrt(r0 * r0 + r1 * r1)),
              rc = min(abs(r1 - r0) / 2, +cornerRadius.apply(this, arguments)),
              rc0 = rc,
              rc1 = rc,
              t0,
              t1;

          // Apply padding? Note that since r1 ≥ r0, da1 ≥ da0.
          if (rp > epsilon$1) {
            var p0 = asin(rp / r0 * sin(ap)),
                p1 = asin(rp / r1 * sin(ap));
            if ((da0 -= p0 * 2) > epsilon$1) p0 *= (cw ? 1 : -1), a00 += p0, a10 -= p0;
            else da0 = 0, a00 = a10 = (a0 + a1) / 2;
            if ((da1 -= p1 * 2) > epsilon$1) p1 *= (cw ? 1 : -1), a01 += p1, a11 -= p1;
            else da1 = 0, a01 = a11 = (a0 + a1) / 2;
          }

          var x01 = r1 * cos(a01),
              y01 = r1 * sin(a01),
              x10 = r0 * cos(a10),
              y10 = r0 * sin(a10);

          // Apply rounded corners?
          if (rc > epsilon$1) {
            var x11 = r1 * cos(a11),
                y11 = r1 * sin(a11),
                x00 = r0 * cos(a00),
                y00 = r0 * sin(a00),
                oc;

            // Restrict the corner radius according to the sector angle. If this
            // intersection fails, it’s probably because the arc is too small, so
            // disable the corner radius entirely.
            if (da < pi$1) {
              if (oc = intersect(x01, y01, x00, y00, x11, y11, x10, y10)) {
                var ax = x01 - oc[0],
                    ay = y01 - oc[1],
                    bx = x11 - oc[0],
                    by = y11 - oc[1],
                    kc = 1 / sin(acos((ax * bx + ay * by) / (sqrt(ax * ax + ay * ay) * sqrt(bx * bx + by * by))) / 2),
                    lc = sqrt(oc[0] * oc[0] + oc[1] * oc[1]);
                rc0 = min(rc, (r0 - lc) / (kc - 1));
                rc1 = min(rc, (r1 - lc) / (kc + 1));
              } else {
                rc0 = rc1 = 0;
              }
            }
          }

          // Is the sector collapsed to a line?
          if (!(da1 > epsilon$1)) context.moveTo(x01, y01);

          // Does the sector’s outer ring have rounded corners?
          else if (rc1 > epsilon$1) {
            t0 = cornerTangents(x00, y00, x01, y01, r1, rc1, cw);
            t1 = cornerTangents(x11, y11, x10, y10, r1, rc1, cw);

            context.moveTo(t0.cx + t0.x01, t0.cy + t0.y01);

            // Have the corners merged?
            if (rc1 < rc) context.arc(t0.cx, t0.cy, rc1, atan2(t0.y01, t0.x01), atan2(t1.y01, t1.x01), !cw);

            // Otherwise, draw the two corners and the ring.
            else {
              context.arc(t0.cx, t0.cy, rc1, atan2(t0.y01, t0.x01), atan2(t0.y11, t0.x11), !cw);
              context.arc(0, 0, r1, atan2(t0.cy + t0.y11, t0.cx + t0.x11), atan2(t1.cy + t1.y11, t1.cx + t1.x11), !cw);
              context.arc(t1.cx, t1.cy, rc1, atan2(t1.y11, t1.x11), atan2(t1.y01, t1.x01), !cw);
            }
          }

          // Or is the outer ring just a circular arc?
          else context.moveTo(x01, y01), context.arc(0, 0, r1, a01, a11, !cw);

          // Is there no inner ring, and it’s a circular sector?
          // Or perhaps it’s an annular sector collapsed due to padding?
          if (!(r0 > epsilon$1) || !(da0 > epsilon$1)) context.lineTo(x10, y10);

          // Does the sector’s inner ring (or point) have rounded corners?
          else if (rc0 > epsilon$1) {
            t0 = cornerTangents(x10, y10, x11, y11, r0, -rc0, cw);
            t1 = cornerTangents(x01, y01, x00, y00, r0, -rc0, cw);

            context.lineTo(t0.cx + t0.x01, t0.cy + t0.y01);

            // Have the corners merged?
            if (rc0 < rc) context.arc(t0.cx, t0.cy, rc0, atan2(t0.y01, t0.x01), atan2(t1.y01, t1.x01), !cw);

            // Otherwise, draw the two corners and the ring.
            else {
              context.arc(t0.cx, t0.cy, rc0, atan2(t0.y01, t0.x01), atan2(t0.y11, t0.x11), !cw);
              context.arc(0, 0, r0, atan2(t0.cy + t0.y11, t0.cx + t0.x11), atan2(t1.cy + t1.y11, t1.cx + t1.x11), cw);
              context.arc(t1.cx, t1.cy, rc0, atan2(t1.y11, t1.x11), atan2(t1.y01, t1.x01), !cw);
            }
          }

          // Or is the inner ring just a circular arc?
          else context.arc(0, 0, r0, a10, a00, cw);
        }

        context.closePath();

        if (buffer) return context = null, buffer + "" || null;
      }

      arc.centroid = function() {
        var r = (+innerRadius.apply(this, arguments) + +outerRadius.apply(this, arguments)) / 2,
            a = (+startAngle.apply(this, arguments) + +endAngle.apply(this, arguments)) / 2 - pi$1 / 2;
        return [cos(a) * r, sin(a) * r];
      };

      arc.innerRadius = function(_) {
        return arguments.length ? (innerRadius = typeof _ === "function" ? _ : constant$1(+_), arc) : innerRadius;
      };

      arc.outerRadius = function(_) {
        return arguments.length ? (outerRadius = typeof _ === "function" ? _ : constant$1(+_), arc) : outerRadius;
      };

      arc.cornerRadius = function(_) {
        return arguments.length ? (cornerRadius = typeof _ === "function" ? _ : constant$1(+_), arc) : cornerRadius;
      };

      arc.padRadius = function(_) {
        return arguments.length ? (padRadius = _ == null ? null : typeof _ === "function" ? _ : constant$1(+_), arc) : padRadius;
      };

      arc.startAngle = function(_) {
        return arguments.length ? (startAngle = typeof _ === "function" ? _ : constant$1(+_), arc) : startAngle;
      };

      arc.endAngle = function(_) {
        return arguments.length ? (endAngle = typeof _ === "function" ? _ : constant$1(+_), arc) : endAngle;
      };

      arc.padAngle = function(_) {
        return arguments.length ? (padAngle = typeof _ === "function" ? _ : constant$1(+_), arc) : padAngle;
      };

      arc.context = function(_) {
        return arguments.length ? ((context = _ == null ? null : _), arc) : context;
      };

      return arc;
    }

    /* src/components/MonthPath.svelte generated by Svelte v3.59.2 */
    const file$6 = "src/components/MonthPath.svelte";

    function create_fragment$6(ctx) {
    	let path;
    	let path_d_value;

    	const block = {
    		c: function create() {
    			path = svg_element("path");

    			attr_dev(path, "d", path_d_value = /*arcGen*/ ctx[6]({
    				startAngle: /*startAngle*/ ctx[0],
    				endAngle: /*endAngle*/ ctx[1]
    			}));

    			attr_dev(path, "fill", /*fillColor*/ ctx[3]);
    			attr_dev(path, "stroke", /*color*/ ctx[2]);
    			attr_dev(path, "stroke-width", "1.2");
    			attr_dev(path, "class", "svelte-ogasff");
    			toggle_class(path, "selected", /*selected*/ ctx[4]);
    			toggle_class(path, "current", /*current*/ ctx[5]);
    			add_location(path, file$6, 26, 0, 721);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*arcGen, startAngle, endAngle*/ 67 && path_d_value !== (path_d_value = /*arcGen*/ ctx[6]({
    				startAngle: /*startAngle*/ ctx[0],
    				endAngle: /*endAngle*/ ctx[1]
    			}))) {
    				attr_dev(path, "d", path_d_value);
    			}

    			if (dirty & /*fillColor*/ 8) {
    				attr_dev(path, "fill", /*fillColor*/ ctx[3]);
    			}

    			if (dirty & /*color*/ 4) {
    				attr_dev(path, "stroke", /*color*/ ctx[2]);
    			}

    			if (dirty & /*selected*/ 16) {
    				toggle_class(path, "selected", /*selected*/ ctx[4]);
    			}

    			if (dirty & /*current*/ 32) {
    				toggle_class(path, "current", /*current*/ ctx[5]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let arcGen;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MonthPath', slots, []);
    	let { innerRadius } = $$props;
    	let { outerRadius } = $$props;
    	let { startAngle } = $$props;
    	let { endAngle } = $$props;
    	let { color = 'teal' } = $$props;
    	let { fillColor = 'burnt-umber' } = $$props;
    	let { selected = false } = $$props;
    	let { current = false } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (innerRadius === undefined && !('innerRadius' in $$props || $$self.$$.bound[$$self.$$.props['innerRadius']])) {
    			console.warn("<MonthPath> was created without expected prop 'innerRadius'");
    		}

    		if (outerRadius === undefined && !('outerRadius' in $$props || $$self.$$.bound[$$self.$$.props['outerRadius']])) {
    			console.warn("<MonthPath> was created without expected prop 'outerRadius'");
    		}

    		if (startAngle === undefined && !('startAngle' in $$props || $$self.$$.bound[$$self.$$.props['startAngle']])) {
    			console.warn("<MonthPath> was created without expected prop 'startAngle'");
    		}

    		if (endAngle === undefined && !('endAngle' in $$props || $$self.$$.bound[$$self.$$.props['endAngle']])) {
    			console.warn("<MonthPath> was created without expected prop 'endAngle'");
    		}
    	});

    	const writable_props = [
    		'innerRadius',
    		'outerRadius',
    		'startAngle',
    		'endAngle',
    		'color',
    		'fillColor',
    		'selected',
    		'current'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MonthPath> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('innerRadius' in $$props) $$invalidate(7, innerRadius = $$props.innerRadius);
    		if ('outerRadius' in $$props) $$invalidate(8, outerRadius = $$props.outerRadius);
    		if ('startAngle' in $$props) $$invalidate(0, startAngle = $$props.startAngle);
    		if ('endAngle' in $$props) $$invalidate(1, endAngle = $$props.endAngle);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('fillColor' in $$props) $$invalidate(3, fillColor = $$props.fillColor);
    		if ('selected' in $$props) $$invalidate(4, selected = $$props.selected);
    		if ('current' in $$props) $$invalidate(5, current = $$props.current);
    	};

    	$$self.$capture_state = () => ({
    		arc,
    		innerRadius,
    		outerRadius,
    		startAngle,
    		endAngle,
    		color,
    		fillColor,
    		selected,
    		current,
    		arcGen
    	});

    	$$self.$inject_state = $$props => {
    		if ('innerRadius' in $$props) $$invalidate(7, innerRadius = $$props.innerRadius);
    		if ('outerRadius' in $$props) $$invalidate(8, outerRadius = $$props.outerRadius);
    		if ('startAngle' in $$props) $$invalidate(0, startAngle = $$props.startAngle);
    		if ('endAngle' in $$props) $$invalidate(1, endAngle = $$props.endAngle);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('fillColor' in $$props) $$invalidate(3, fillColor = $$props.fillColor);
    		if ('selected' in $$props) $$invalidate(4, selected = $$props.selected);
    		if ('current' in $$props) $$invalidate(5, current = $$props.current);
    		if ('arcGen' in $$props) $$invalidate(6, arcGen = $$props.arcGen);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*innerRadius, outerRadius*/ 384) {
    			$$invalidate(6, arcGen = arc().innerRadius(innerRadius).outerRadius(outerRadius));
    		}
    	};

    	return [
    		startAngle,
    		endAngle,
    		color,
    		fillColor,
    		selected,
    		current,
    		arcGen,
    		innerRadius,
    		outerRadius
    	];
    }

    class MonthPath extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			innerRadius: 7,
    			outerRadius: 8,
    			startAngle: 0,
    			endAngle: 1,
    			color: 2,
    			fillColor: 3,
    			selected: 4,
    			current: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MonthPath",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get innerRadius() {
    		throw new Error("<MonthPath>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set innerRadius(value) {
    		throw new Error("<MonthPath>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get outerRadius() {
    		throw new Error("<MonthPath>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set outerRadius(value) {
    		throw new Error("<MonthPath>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get startAngle() {
    		throw new Error("<MonthPath>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set startAngle(value) {
    		throw new Error("<MonthPath>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get endAngle() {
    		throw new Error("<MonthPath>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set endAngle(value) {
    		throw new Error("<MonthPath>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<MonthPath>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<MonthPath>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fillColor() {
    		throw new Error("<MonthPath>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fillColor(value) {
    		throw new Error("<MonthPath>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selected() {
    		throw new Error("<MonthPath>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selected(value) {
    		throw new Error("<MonthPath>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get current() {
    		throw new Error("<MonthPath>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set current(value) {
    		throw new Error("<MonthPath>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/RadialAxis.svelte generated by Svelte v3.59.2 */
    const file$5 = "src/components/RadialAxis.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	return child_ctx;
    }

    // (45:4) {#if axisLabel}
    function create_if_block$3(ctx) {
    	let text_1;
    	let t;
    	let text_1_y_value;

    	const block = {
    		c: function create() {
    			text_1 = svg_element("text");
    			t = text$1(/*axisLabel*/ ctx[6]);
    			attr_dev(text_1, "x", /*cx*/ ctx[1]);
    			attr_dev(text_1, "y", text_1_y_value = /*cy*/ ctx[2] - /*maxRadius*/ ctx[10] - /*fontSize*/ ctx[7] * 2);
    			attr_dev(text_1, "text-anchor", "middle");
    			attr_dev(text_1, "font-size", /*fontSize*/ ctx[7]);
    			attr_dev(text_1, "fill", /*labelColor*/ ctx[5]);
    			add_location(text_1, file$5, 45, 8, 1064);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, text_1, anchor);
    			append_dev(text_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*axisLabel*/ 64) set_data_dev(t, /*axisLabel*/ ctx[6]);

    			if (dirty & /*cx*/ 2) {
    				attr_dev(text_1, "x", /*cx*/ ctx[1]);
    			}

    			if (dirty & /*cy, maxRadius, fontSize*/ 1156 && text_1_y_value !== (text_1_y_value = /*cy*/ ctx[2] - /*maxRadius*/ ctx[10] - /*fontSize*/ ctx[7] * 2)) {
    				attr_dev(text_1, "y", text_1_y_value);
    			}

    			if (dirty & /*fontSize*/ 128) {
    				attr_dev(text_1, "font-size", /*fontSize*/ ctx[7]);
    			}

    			if (dirty & /*labelColor*/ 32) {
    				attr_dev(text_1, "fill", /*labelColor*/ ctx[5]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(text_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(45:4) {#if axisLabel}",
    		ctx
    	});

    	return block;
    }

    // (57:4) {#each minors as t}
    function create_each_block_1(ctx) {
    	let circle;
    	let circle_r_value;

    	const block = {
    		c: function create() {
    			circle = svg_element("circle");
    			attr_dev(circle, "class", "grid-ring svelte-15uxp6l");
    			attr_dev(circle, "cx", /*cx*/ ctx[1]);
    			attr_dev(circle, "cy", /*cy*/ ctx[2]);
    			attr_dev(circle, "r", circle_r_value = /*scale*/ ctx[0](/*t*/ ctx[16]));
    			attr_dev(circle, "fill", "none");
    			attr_dev(circle, "stroke", /*minorColor*/ ctx[4]);
    			attr_dev(circle, "stroke-width", "1");
    			attr_dev(circle, "stroke-dasharray", "1 3");
    			add_location(circle, file$5, 57, 8, 1327);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, circle, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*cx*/ 2) {
    				attr_dev(circle, "cx", /*cx*/ ctx[1]);
    			}

    			if (dirty & /*cy*/ 4) {
    				attr_dev(circle, "cy", /*cy*/ ctx[2]);
    			}

    			if (dirty & /*scale, minors*/ 513 && circle_r_value !== (circle_r_value = /*scale*/ ctx[0](/*t*/ ctx[16]))) {
    				attr_dev(circle, "r", circle_r_value);
    			}

    			if (dirty & /*minorColor*/ 16) {
    				attr_dev(circle, "stroke", /*minorColor*/ ctx[4]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(circle);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(57:4) {#each minors as t}",
    		ctx
    	});

    	return block;
    }

    // (70:4) {#each majors as t}
    function create_each_block$3(ctx) {
    	let circle;
    	let circle_r_value;
    	let text_1;
    	let t_value = /*fmt*/ ctx[11](/*t*/ ctx[16]) + "";
    	let t;
    	let text_1_y_value;

    	const block = {
    		c: function create() {
    			circle = svg_element("circle");
    			text_1 = svg_element("text");
    			t = text$1(t_value);
    			attr_dev(circle, "class", "grid-ring svelte-15uxp6l");
    			attr_dev(circle, "cx", /*cx*/ ctx[1]);
    			attr_dev(circle, "cy", /*cy*/ ctx[2]);
    			attr_dev(circle, "r", circle_r_value = /*scale*/ ctx[0](/*t*/ ctx[16]));
    			attr_dev(circle, "fill", "none");
    			attr_dev(circle, "stroke", /*strokeColor*/ ctx[3]);
    			attr_dev(circle, "stroke-width", "1");
    			add_location(circle, file$5, 70, 8, 1606);
    			attr_dev(text_1, "class", "grid-label svelte-15uxp6l");
    			attr_dev(text_1, "x", /*cx*/ ctx[1]);
    			attr_dev(text_1, "y", text_1_y_value = /*cy*/ ctx[2] - /*scale*/ ctx[0](/*t*/ ctx[16]));
    			attr_dev(text_1, "dy", "-4");
    			attr_dev(text_1, "dx", "-10");
    			attr_dev(text_1, "text-anchor", "middle");
    			attr_dev(text_1, "fill", /*labelColor*/ ctx[5]);
    			attr_dev(text_1, "font-size", /*fontSize*/ ctx[7]);
    			add_location(text_1, file$5, 79, 8, 1814);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, circle, anchor);
    			insert_dev(target, text_1, anchor);
    			append_dev(text_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*cx*/ 2) {
    				attr_dev(circle, "cx", /*cx*/ ctx[1]);
    			}

    			if (dirty & /*cy*/ 4) {
    				attr_dev(circle, "cy", /*cy*/ ctx[2]);
    			}

    			if (dirty & /*scale, majors*/ 257 && circle_r_value !== (circle_r_value = /*scale*/ ctx[0](/*t*/ ctx[16]))) {
    				attr_dev(circle, "r", circle_r_value);
    			}

    			if (dirty & /*strokeColor*/ 8) {
    				attr_dev(circle, "stroke", /*strokeColor*/ ctx[3]);
    			}

    			if (dirty & /*fmt, majors*/ 2304 && t_value !== (t_value = /*fmt*/ ctx[11](/*t*/ ctx[16]) + "")) set_data_dev(t, t_value);

    			if (dirty & /*cx*/ 2) {
    				attr_dev(text_1, "x", /*cx*/ ctx[1]);
    			}

    			if (dirty & /*cy, scale, majors*/ 261 && text_1_y_value !== (text_1_y_value = /*cy*/ ctx[2] - /*scale*/ ctx[0](/*t*/ ctx[16]))) {
    				attr_dev(text_1, "y", text_1_y_value);
    			}

    			if (dirty & /*labelColor*/ 32) {
    				attr_dev(text_1, "fill", /*labelColor*/ ctx[5]);
    			}

    			if (dirty & /*fontSize*/ 128) {
    				attr_dev(text_1, "font-size", /*fontSize*/ ctx[7]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(circle);
    			if (detaching) detach_dev(text_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(70:4) {#each majors as t}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let g;
    	let if_block_anchor;
    	let each0_anchor;
    	let if_block = /*axisLabel*/ ctx[6] && create_if_block$3(ctx);
    	let each_value_1 = /*minors*/ ctx[9];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*majors*/ ctx[8];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			g = svg_element("g");
    			if (if_block) if_block.c();
    			if_block_anchor = empty();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			each0_anchor = empty();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(g, "class", "radial-axis");
    			add_location(g, file$5, 43, 0, 1012);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g, anchor);
    			if (if_block) if_block.m(g, null);
    			append_dev(g, if_block_anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(g, null);
    				}
    			}

    			append_dev(g, each0_anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(g, null);
    				}
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*axisLabel*/ ctx[6]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					if_block.m(g, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*cx, cy, scale, minors, minorColor*/ 535) {
    				each_value_1 = /*minors*/ ctx[9];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(g, each0_anchor);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*cx, cy, scale, majors, labelColor, fontSize, fmt, strokeColor*/ 2479) {
    				each_value = /*majors*/ ctx[8];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(g, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let majorStep;
    	let minorStep;
    	let fmt;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('RadialAxis', slots, []);
    	let { scale } = $$props;
    	let { cx = 0 } = $$props;
    	let { cy = 0 } = $$props;
    	let { tickCount = 4 } = $$props;
    	let { subCount = 4 } = $$props;
    	let { strokeColor = '#999' } = $$props;
    	let { minorColor = '#ccc' } = $$props;
    	let { labelColor = '#666' } = $$props;
    	let { axisLabel = '' } = $$props;
    	let { fontSize } = $$props;

    	// Construct major and minor tick pattern
    	let majors = [];

    	let minors = [];

    	// Figure out axis label placement
    	let maxRadius;

    	$$self.$$.on_mount.push(function () {
    		if (scale === undefined && !('scale' in $$props || $$self.$$.bound[$$self.$$.props['scale']])) {
    			console.warn("<RadialAxis> was created without expected prop 'scale'");
    		}

    		if (fontSize === undefined && !('fontSize' in $$props || $$self.$$.bound[$$self.$$.props['fontSize']])) {
    			console.warn("<RadialAxis> was created without expected prop 'fontSize'");
    		}
    	});

    	const writable_props = [
    		'scale',
    		'cx',
    		'cy',
    		'tickCount',
    		'subCount',
    		'strokeColor',
    		'minorColor',
    		'labelColor',
    		'axisLabel',
    		'fontSize'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<RadialAxis> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('scale' in $$props) $$invalidate(0, scale = $$props.scale);
    		if ('cx' in $$props) $$invalidate(1, cx = $$props.cx);
    		if ('cy' in $$props) $$invalidate(2, cy = $$props.cy);
    		if ('tickCount' in $$props) $$invalidate(12, tickCount = $$props.tickCount);
    		if ('subCount' in $$props) $$invalidate(13, subCount = $$props.subCount);
    		if ('strokeColor' in $$props) $$invalidate(3, strokeColor = $$props.strokeColor);
    		if ('minorColor' in $$props) $$invalidate(4, minorColor = $$props.minorColor);
    		if ('labelColor' in $$props) $$invalidate(5, labelColor = $$props.labelColor);
    		if ('axisLabel' in $$props) $$invalidate(6, axisLabel = $$props.axisLabel);
    		if ('fontSize' in $$props) $$invalidate(7, fontSize = $$props.fontSize);
    	};

    	$$self.$capture_state = () => ({
    		range,
    		scale,
    		cx,
    		cy,
    		tickCount,
    		subCount,
    		strokeColor,
    		minorColor,
    		labelColor,
    		axisLabel,
    		fontSize,
    		majors,
    		minors,
    		maxRadius,
    		fmt,
    		minorStep,
    		majorStep
    	});

    	$$self.$inject_state = $$props => {
    		if ('scale' in $$props) $$invalidate(0, scale = $$props.scale);
    		if ('cx' in $$props) $$invalidate(1, cx = $$props.cx);
    		if ('cy' in $$props) $$invalidate(2, cy = $$props.cy);
    		if ('tickCount' in $$props) $$invalidate(12, tickCount = $$props.tickCount);
    		if ('subCount' in $$props) $$invalidate(13, subCount = $$props.subCount);
    		if ('strokeColor' in $$props) $$invalidate(3, strokeColor = $$props.strokeColor);
    		if ('minorColor' in $$props) $$invalidate(4, minorColor = $$props.minorColor);
    		if ('labelColor' in $$props) $$invalidate(5, labelColor = $$props.labelColor);
    		if ('axisLabel' in $$props) $$invalidate(6, axisLabel = $$props.axisLabel);
    		if ('fontSize' in $$props) $$invalidate(7, fontSize = $$props.fontSize);
    		if ('majors' in $$props) $$invalidate(8, majors = $$props.majors);
    		if ('minors' in $$props) $$invalidate(9, minors = $$props.minors);
    		if ('maxRadius' in $$props) $$invalidate(10, maxRadius = $$props.maxRadius);
    		if ('fmt' in $$props) $$invalidate(11, fmt = $$props.fmt);
    		if ('minorStep' in $$props) $$invalidate(14, minorStep = $$props.minorStep);
    		if ('majorStep' in $$props) $$invalidate(15, majorStep = $$props.majorStep);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*scale, tickCount*/ 4097) {
    			$$invalidate(8, majors = scale.ticks(tickCount));
    		}

    		if ($$self.$$.dirty & /*majors*/ 256) {
    			$$invalidate(15, majorStep = majors.length > 1 ? majors[1] - majors[0] : majors[0]);
    		}

    		if ($$self.$$.dirty & /*majorStep, subCount*/ 40960) {
    			$$invalidate(14, minorStep = majorStep / subCount);
    		}

    		if ($$self.$$.dirty & /*scale, minorStep, majors*/ 16641) {
    			{
    				const [d0, d1] = scale.domain();
    				const all = range(d0, d1 + 1e-6, minorStep);
    				$$invalidate(9, minors = all.filter(v => !majors.includes(v)));
    			}
    		}

    		if ($$self.$$.dirty & /*scale*/ 1) {
    			{
    				const maxDomain = scale.domain()[1];
    				$$invalidate(10, maxRadius = scale(maxDomain));
    			}
    		}

    		if ($$self.$$.dirty & /*scale, tickCount*/ 4097) {
    			$$invalidate(11, fmt = scale.tickFormat ? scale.tickFormat(tickCount) : v => v);
    		}
    	};

    	return [
    		scale,
    		cx,
    		cy,
    		strokeColor,
    		minorColor,
    		labelColor,
    		axisLabel,
    		fontSize,
    		majors,
    		minors,
    		maxRadius,
    		fmt,
    		tickCount,
    		subCount,
    		minorStep,
    		majorStep
    	];
    }

    class RadialAxis extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			scale: 0,
    			cx: 1,
    			cy: 2,
    			tickCount: 12,
    			subCount: 13,
    			strokeColor: 3,
    			minorColor: 4,
    			labelColor: 5,
    			axisLabel: 6,
    			fontSize: 7
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RadialAxis",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get scale() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scale(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cx() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cx(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cy() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cy(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tickCount() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tickCount(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get subCount() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set subCount(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get strokeColor() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set strokeColor(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get minorColor() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set minorColor(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get labelColor() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set labelColor(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get axisLabel() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set axisLabel(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fontSize() {
    		throw new Error("<RadialAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fontSize(value) {
    		throw new Error("<RadialAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/MonthSpokes.svelte generated by Svelte v3.59.2 */

    const file$4 = "src/components/MonthSpokes.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	const constants_0 = (/*i*/ child_ctx[11] + 0.5) * /*stepRad*/ child_ctx[8];
    	child_ctx[12] = constants_0;
    	const constants_1 = (/*i*/ child_ctx[11] + 0.5) * /*stepDeg*/ child_ctx[7];
    	child_ctx[13] = constants_1;
    	const constants_2 = /*i*/ child_ctx[11] * /*stepRad*/ child_ctx[8];
    	child_ctx[14] = constants_2;
    	return child_ctx;
    }

    // (18:4) {#each indices as i}
    function create_each_block$2(ctx) {
    	let line;
    	let line_x__value;
    	let line_y__value;
    	let g;
    	let text_1;
    	let t_value = (/*labels*/ ctx[2][/*i*/ ctx[11]] ?? /*i*/ ctx[11] + 1) + "";
    	let t;
    	let text_1_y_value;
    	let g_transform_value;

    	const block = {
    		c: function create() {
    			line = svg_element("line");
    			g = svg_element("g");
    			text_1 = svg_element("text");
    			t = text$1(t_value);
    			attr_dev(line, "x1", "0");
    			attr_dev(line, "y1", "0");
    			attr_dev(line, "x2", line_x__value = Math.cos(/*startAngle*/ ctx[14]) * /*radius*/ ctx[0]);
    			attr_dev(line, "y2", line_y__value = Math.sin(/*startAngle*/ ctx[14]) * /*radius*/ ctx[0]);
    			attr_dev(line, "stroke", /*spokeColor*/ ctx[3]);
    			attr_dev(line, "stroke-width", "1");
    			add_location(line, file$4, 22, 8, 568);
    			attr_dev(text_1, "x", "0");
    			attr_dev(text_1, "y", text_1_y_value = -(/*radius*/ ctx[0] + /*labelOffset*/ ctx[1]));
    			attr_dev(text_1, "text-anchor", "middle");
    			attr_dev(text_1, "alignment-baseline", "middle");
    			attr_dev(text_1, "font-size", /*fontSize*/ ctx[5]);
    			attr_dev(text_1, "fill", /*labelColor*/ ctx[4]);
    			add_location(text_1, file$4, 32, 12, 843);
    			attr_dev(g, "transform", g_transform_value = `rotate(${/*midDeg*/ ctx[13]})`);
    			add_location(g, file$4, 31, 8, 795);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, line, anchor);
    			insert_dev(target, g, anchor);
    			append_dev(g, text_1);
    			append_dev(text_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*indices, stepRad, radius*/ 321 && line_x__value !== (line_x__value = Math.cos(/*startAngle*/ ctx[14]) * /*radius*/ ctx[0])) {
    				attr_dev(line, "x2", line_x__value);
    			}

    			if (dirty & /*indices, stepRad, radius*/ 321 && line_y__value !== (line_y__value = Math.sin(/*startAngle*/ ctx[14]) * /*radius*/ ctx[0])) {
    				attr_dev(line, "y2", line_y__value);
    			}

    			if (dirty & /*spokeColor*/ 8) {
    				attr_dev(line, "stroke", /*spokeColor*/ ctx[3]);
    			}

    			if (dirty & /*labels, indices*/ 68 && t_value !== (t_value = (/*labels*/ ctx[2][/*i*/ ctx[11]] ?? /*i*/ ctx[11] + 1) + "")) set_data_dev(t, t_value);

    			if (dirty & /*radius, labelOffset*/ 3 && text_1_y_value !== (text_1_y_value = -(/*radius*/ ctx[0] + /*labelOffset*/ ctx[1]))) {
    				attr_dev(text_1, "y", text_1_y_value);
    			}

    			if (dirty & /*fontSize*/ 32) {
    				attr_dev(text_1, "font-size", /*fontSize*/ ctx[5]);
    			}

    			if (dirty & /*labelColor*/ 16) {
    				attr_dev(text_1, "fill", /*labelColor*/ ctx[4]);
    			}

    			if (dirty & /*indices, stepDeg*/ 192 && g_transform_value !== (g_transform_value = `rotate(${/*midDeg*/ ctx[13]})`)) {
    				attr_dev(g, "transform", g_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(line);
    			if (detaching) detach_dev(g);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(18:4) {#each indices as i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let g;
    	let each_value = /*indices*/ ctx[6];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			g = svg_element("g");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(g, "class", "month-spokes");
    			add_location(g, file$4, 16, 0, 373);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(g, null);
    				}
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*indices, stepDeg, radius, labelOffset, fontSize, labelColor, labels, Math, stepRad, spokeColor*/ 511) {
    				each_value = /*indices*/ ctx[6];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(g, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let stepRad;
    	let stepDeg;
    	let indices;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MonthSpokes', slots, []);
    	let { count = 12 } = $$props;
    	let { radius = 100 } = $$props;
    	let { labelOffset = 16 } = $$props;
    	let { labels = [] } = $$props;
    	let { spokeColor } = $$props;
    	let { labelColor } = $$props;
    	let { fontSize } = $$props;
    	const TWO_PI = 2 * Math.PI;

    	$$self.$$.on_mount.push(function () {
    		if (spokeColor === undefined && !('spokeColor' in $$props || $$self.$$.bound[$$self.$$.props['spokeColor']])) {
    			console.warn("<MonthSpokes> was created without expected prop 'spokeColor'");
    		}

    		if (labelColor === undefined && !('labelColor' in $$props || $$self.$$.bound[$$self.$$.props['labelColor']])) {
    			console.warn("<MonthSpokes> was created without expected prop 'labelColor'");
    		}

    		if (fontSize === undefined && !('fontSize' in $$props || $$self.$$.bound[$$self.$$.props['fontSize']])) {
    			console.warn("<MonthSpokes> was created without expected prop 'fontSize'");
    		}
    	});

    	const writable_props = [
    		'count',
    		'radius',
    		'labelOffset',
    		'labels',
    		'spokeColor',
    		'labelColor',
    		'fontSize'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MonthSpokes> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('count' in $$props) $$invalidate(9, count = $$props.count);
    		if ('radius' in $$props) $$invalidate(0, radius = $$props.radius);
    		if ('labelOffset' in $$props) $$invalidate(1, labelOffset = $$props.labelOffset);
    		if ('labels' in $$props) $$invalidate(2, labels = $$props.labels);
    		if ('spokeColor' in $$props) $$invalidate(3, spokeColor = $$props.spokeColor);
    		if ('labelColor' in $$props) $$invalidate(4, labelColor = $$props.labelColor);
    		if ('fontSize' in $$props) $$invalidate(5, fontSize = $$props.fontSize);
    	};

    	$$self.$capture_state = () => ({
    		count,
    		radius,
    		labelOffset,
    		labels,
    		spokeColor,
    		labelColor,
    		fontSize,
    		TWO_PI,
    		indices,
    		stepDeg,
    		stepRad
    	});

    	$$self.$inject_state = $$props => {
    		if ('count' in $$props) $$invalidate(9, count = $$props.count);
    		if ('radius' in $$props) $$invalidate(0, radius = $$props.radius);
    		if ('labelOffset' in $$props) $$invalidate(1, labelOffset = $$props.labelOffset);
    		if ('labels' in $$props) $$invalidate(2, labels = $$props.labels);
    		if ('spokeColor' in $$props) $$invalidate(3, spokeColor = $$props.spokeColor);
    		if ('labelColor' in $$props) $$invalidate(4, labelColor = $$props.labelColor);
    		if ('fontSize' in $$props) $$invalidate(5, fontSize = $$props.fontSize);
    		if ('indices' in $$props) $$invalidate(6, indices = $$props.indices);
    		if ('stepDeg' in $$props) $$invalidate(7, stepDeg = $$props.stepDeg);
    		if ('stepRad' in $$props) $$invalidate(8, stepRad = $$props.stepRad);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*count*/ 512) {
    			$$invalidate(8, stepRad = TWO_PI / count);
    		}

    		if ($$self.$$.dirty & /*count*/ 512) {
    			$$invalidate(7, stepDeg = 360 / count);
    		}

    		if ($$self.$$.dirty & /*count*/ 512) {
    			$$invalidate(6, indices = Array.from({ length: count }, (_, i) => i));
    		}
    	};

    	return [
    		radius,
    		labelOffset,
    		labels,
    		spokeColor,
    		labelColor,
    		fontSize,
    		indices,
    		stepDeg,
    		stepRad,
    		count
    	];
    }

    class MonthSpokes extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			count: 9,
    			radius: 0,
    			labelOffset: 1,
    			labels: 2,
    			spokeColor: 3,
    			labelColor: 4,
    			fontSize: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MonthSpokes",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get count() {
    		throw new Error("<MonthSpokes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set count(value) {
    		throw new Error("<MonthSpokes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get radius() {
    		throw new Error("<MonthSpokes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set radius(value) {
    		throw new Error("<MonthSpokes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get labelOffset() {
    		throw new Error("<MonthSpokes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set labelOffset(value) {
    		throw new Error("<MonthSpokes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get labels() {
    		throw new Error("<MonthSpokes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set labels(value) {
    		throw new Error("<MonthSpokes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get spokeColor() {
    		throw new Error("<MonthSpokes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set spokeColor(value) {
    		throw new Error("<MonthSpokes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get labelColor() {
    		throw new Error("<MonthSpokes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set labelColor(value) {
    		throw new Error("<MonthSpokes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fontSize() {
    		throw new Error("<MonthSpokes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fontSize(value) {
    		throw new Error("<MonthSpokes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function initRange(domain, range) {
      switch (arguments.length) {
        case 0: break;
        case 1: this.range(domain); break;
        default: this.range(range).domain(domain); break;
      }
      return this;
    }

    function define(constructor, factory, prototype) {
      constructor.prototype = factory.prototype = prototype;
      prototype.constructor = constructor;
    }

    function extend(parent, definition) {
      var prototype = Object.create(parent.prototype);
      for (var key in definition) prototype[key] = definition[key];
      return prototype;
    }

    function Color() {}

    var darker = 0.7;
    var brighter = 1 / darker;

    var reI = "\\s*([+-]?\\d+)\\s*",
        reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*",
        reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
        reHex = /^#([0-9a-f]{3,8})$/,
        reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`),
        reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`),
        reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`),
        reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`),
        reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`),
        reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);

    var named = {
      aliceblue: 0xf0f8ff,
      antiquewhite: 0xfaebd7,
      aqua: 0x00ffff,
      aquamarine: 0x7fffd4,
      azure: 0xf0ffff,
      beige: 0xf5f5dc,
      bisque: 0xffe4c4,
      black: 0x000000,
      blanchedalmond: 0xffebcd,
      blue: 0x0000ff,
      blueviolet: 0x8a2be2,
      brown: 0xa52a2a,
      burlywood: 0xdeb887,
      cadetblue: 0x5f9ea0,
      chartreuse: 0x7fff00,
      chocolate: 0xd2691e,
      coral: 0xff7f50,
      cornflowerblue: 0x6495ed,
      cornsilk: 0xfff8dc,
      crimson: 0xdc143c,
      cyan: 0x00ffff,
      darkblue: 0x00008b,
      darkcyan: 0x008b8b,
      darkgoldenrod: 0xb8860b,
      darkgray: 0xa9a9a9,
      darkgreen: 0x006400,
      darkgrey: 0xa9a9a9,
      darkkhaki: 0xbdb76b,
      darkmagenta: 0x8b008b,
      darkolivegreen: 0x556b2f,
      darkorange: 0xff8c00,
      darkorchid: 0x9932cc,
      darkred: 0x8b0000,
      darksalmon: 0xe9967a,
      darkseagreen: 0x8fbc8f,
      darkslateblue: 0x483d8b,
      darkslategray: 0x2f4f4f,
      darkslategrey: 0x2f4f4f,
      darkturquoise: 0x00ced1,
      darkviolet: 0x9400d3,
      deeppink: 0xff1493,
      deepskyblue: 0x00bfff,
      dimgray: 0x696969,
      dimgrey: 0x696969,
      dodgerblue: 0x1e90ff,
      firebrick: 0xb22222,
      floralwhite: 0xfffaf0,
      forestgreen: 0x228b22,
      fuchsia: 0xff00ff,
      gainsboro: 0xdcdcdc,
      ghostwhite: 0xf8f8ff,
      gold: 0xffd700,
      goldenrod: 0xdaa520,
      gray: 0x808080,
      green: 0x008000,
      greenyellow: 0xadff2f,
      grey: 0x808080,
      honeydew: 0xf0fff0,
      hotpink: 0xff69b4,
      indianred: 0xcd5c5c,
      indigo: 0x4b0082,
      ivory: 0xfffff0,
      khaki: 0xf0e68c,
      lavender: 0xe6e6fa,
      lavenderblush: 0xfff0f5,
      lawngreen: 0x7cfc00,
      lemonchiffon: 0xfffacd,
      lightblue: 0xadd8e6,
      lightcoral: 0xf08080,
      lightcyan: 0xe0ffff,
      lightgoldenrodyellow: 0xfafad2,
      lightgray: 0xd3d3d3,
      lightgreen: 0x90ee90,
      lightgrey: 0xd3d3d3,
      lightpink: 0xffb6c1,
      lightsalmon: 0xffa07a,
      lightseagreen: 0x20b2aa,
      lightskyblue: 0x87cefa,
      lightslategray: 0x778899,
      lightslategrey: 0x778899,
      lightsteelblue: 0xb0c4de,
      lightyellow: 0xffffe0,
      lime: 0x00ff00,
      limegreen: 0x32cd32,
      linen: 0xfaf0e6,
      magenta: 0xff00ff,
      maroon: 0x800000,
      mediumaquamarine: 0x66cdaa,
      mediumblue: 0x0000cd,
      mediumorchid: 0xba55d3,
      mediumpurple: 0x9370db,
      mediumseagreen: 0x3cb371,
      mediumslateblue: 0x7b68ee,
      mediumspringgreen: 0x00fa9a,
      mediumturquoise: 0x48d1cc,
      mediumvioletred: 0xc71585,
      midnightblue: 0x191970,
      mintcream: 0xf5fffa,
      mistyrose: 0xffe4e1,
      moccasin: 0xffe4b5,
      navajowhite: 0xffdead,
      navy: 0x000080,
      oldlace: 0xfdf5e6,
      olive: 0x808000,
      olivedrab: 0x6b8e23,
      orange: 0xffa500,
      orangered: 0xff4500,
      orchid: 0xda70d6,
      palegoldenrod: 0xeee8aa,
      palegreen: 0x98fb98,
      paleturquoise: 0xafeeee,
      palevioletred: 0xdb7093,
      papayawhip: 0xffefd5,
      peachpuff: 0xffdab9,
      peru: 0xcd853f,
      pink: 0xffc0cb,
      plum: 0xdda0dd,
      powderblue: 0xb0e0e6,
      purple: 0x800080,
      rebeccapurple: 0x663399,
      red: 0xff0000,
      rosybrown: 0xbc8f8f,
      royalblue: 0x4169e1,
      saddlebrown: 0x8b4513,
      salmon: 0xfa8072,
      sandybrown: 0xf4a460,
      seagreen: 0x2e8b57,
      seashell: 0xfff5ee,
      sienna: 0xa0522d,
      silver: 0xc0c0c0,
      skyblue: 0x87ceeb,
      slateblue: 0x6a5acd,
      slategray: 0x708090,
      slategrey: 0x708090,
      snow: 0xfffafa,
      springgreen: 0x00ff7f,
      steelblue: 0x4682b4,
      tan: 0xd2b48c,
      teal: 0x008080,
      thistle: 0xd8bfd8,
      tomato: 0xff6347,
      turquoise: 0x40e0d0,
      violet: 0xee82ee,
      wheat: 0xf5deb3,
      white: 0xffffff,
      whitesmoke: 0xf5f5f5,
      yellow: 0xffff00,
      yellowgreen: 0x9acd32
    };

    define(Color, color, {
      copy(channels) {
        return Object.assign(new this.constructor, this, channels);
      },
      displayable() {
        return this.rgb().displayable();
      },
      hex: color_formatHex, // Deprecated! Use color.formatHex.
      formatHex: color_formatHex,
      formatHex8: color_formatHex8,
      formatHsl: color_formatHsl,
      formatRgb: color_formatRgb,
      toString: color_formatRgb
    });

    function color_formatHex() {
      return this.rgb().formatHex();
    }

    function color_formatHex8() {
      return this.rgb().formatHex8();
    }

    function color_formatHsl() {
      return hslConvert(this).formatHsl();
    }

    function color_formatRgb() {
      return this.rgb().formatRgb();
    }

    function color(format) {
      var m, l;
      format = (format + "").trim().toLowerCase();
      return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) // #ff0000
          : l === 3 ? new Rgb((m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1) // #f00
          : l === 8 ? rgba(m >> 24 & 0xff, m >> 16 & 0xff, m >> 8 & 0xff, (m & 0xff) / 0xff) // #ff000000
          : l === 4 ? rgba((m >> 12 & 0xf) | (m >> 8 & 0xf0), (m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), (((m & 0xf) << 4) | (m & 0xf)) / 0xff) // #f000
          : null) // invalid hex
          : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
          : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
          : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
          : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
          : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
          : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
          : named.hasOwnProperty(format) ? rgbn(named[format]) // eslint-disable-line no-prototype-builtins
          : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
          : null;
    }

    function rgbn(n) {
      return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
    }

    function rgba(r, g, b, a) {
      if (a <= 0) r = g = b = NaN;
      return new Rgb(r, g, b, a);
    }

    function rgbConvert(o) {
      if (!(o instanceof Color)) o = color(o);
      if (!o) return new Rgb;
      o = o.rgb();
      return new Rgb(o.r, o.g, o.b, o.opacity);
    }

    function rgb$1(r, g, b, opacity) {
      return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
    }

    function Rgb(r, g, b, opacity) {
      this.r = +r;
      this.g = +g;
      this.b = +b;
      this.opacity = +opacity;
    }

    define(Rgb, rgb$1, extend(Color, {
      brighter(k) {
        k = k == null ? brighter : Math.pow(brighter, k);
        return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
      },
      darker(k) {
        k = k == null ? darker : Math.pow(darker, k);
        return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
      },
      rgb() {
        return this;
      },
      clamp() {
        return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
      },
      displayable() {
        return (-0.5 <= this.r && this.r < 255.5)
            && (-0.5 <= this.g && this.g < 255.5)
            && (-0.5 <= this.b && this.b < 255.5)
            && (0 <= this.opacity && this.opacity <= 1);
      },
      hex: rgb_formatHex, // Deprecated! Use color.formatHex.
      formatHex: rgb_formatHex,
      formatHex8: rgb_formatHex8,
      formatRgb: rgb_formatRgb,
      toString: rgb_formatRgb
    }));

    function rgb_formatHex() {
      return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
    }

    function rgb_formatHex8() {
      return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
    }

    function rgb_formatRgb() {
      const a = clampa(this.opacity);
      return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
    }

    function clampa(opacity) {
      return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
    }

    function clampi(value) {
      return Math.max(0, Math.min(255, Math.round(value) || 0));
    }

    function hex(value) {
      value = clampi(value);
      return (value < 16 ? "0" : "") + value.toString(16);
    }

    function hsla(h, s, l, a) {
      if (a <= 0) h = s = l = NaN;
      else if (l <= 0 || l >= 1) h = s = NaN;
      else if (s <= 0) h = NaN;
      return new Hsl(h, s, l, a);
    }

    function hslConvert(o) {
      if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
      if (!(o instanceof Color)) o = color(o);
      if (!o) return new Hsl;
      if (o instanceof Hsl) return o;
      o = o.rgb();
      var r = o.r / 255,
          g = o.g / 255,
          b = o.b / 255,
          min = Math.min(r, g, b),
          max = Math.max(r, g, b),
          h = NaN,
          s = max - min,
          l = (max + min) / 2;
      if (s) {
        if (r === max) h = (g - b) / s + (g < b) * 6;
        else if (g === max) h = (b - r) / s + 2;
        else h = (r - g) / s + 4;
        s /= l < 0.5 ? max + min : 2 - max - min;
        h *= 60;
      } else {
        s = l > 0 && l < 1 ? 0 : h;
      }
      return new Hsl(h, s, l, o.opacity);
    }

    function hsl(h, s, l, opacity) {
      return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
    }

    function Hsl(h, s, l, opacity) {
      this.h = +h;
      this.s = +s;
      this.l = +l;
      this.opacity = +opacity;
    }

    define(Hsl, hsl, extend(Color, {
      brighter(k) {
        k = k == null ? brighter : Math.pow(brighter, k);
        return new Hsl(this.h, this.s, this.l * k, this.opacity);
      },
      darker(k) {
        k = k == null ? darker : Math.pow(darker, k);
        return new Hsl(this.h, this.s, this.l * k, this.opacity);
      },
      rgb() {
        var h = this.h % 360 + (this.h < 0) * 360,
            s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
            l = this.l,
            m2 = l + (l < 0.5 ? l : 1 - l) * s,
            m1 = 2 * l - m2;
        return new Rgb(
          hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
          hsl2rgb(h, m1, m2),
          hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
          this.opacity
        );
      },
      clamp() {
        return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
      },
      displayable() {
        return (0 <= this.s && this.s <= 1 || isNaN(this.s))
            && (0 <= this.l && this.l <= 1)
            && (0 <= this.opacity && this.opacity <= 1);
      },
      formatHsl() {
        const a = clampa(this.opacity);
        return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
      }
    }));

    function clamph(value) {
      value = (value || 0) % 360;
      return value < 0 ? value + 360 : value;
    }

    function clampt(value) {
      return Math.max(0, Math.min(1, value || 0));
    }

    /* From FvD 13.37, CSS Color Module Level 3 */
    function hsl2rgb(h, m1, m2) {
      return (h < 60 ? m1 + (m2 - m1) * h / 60
          : h < 180 ? m2
          : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
          : m1) * 255;
    }

    var constant = x => () => x;

    function linear$1(a, d) {
      return function(t) {
        return a + t * d;
      };
    }

    function exponential(a, b, y) {
      return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
        return Math.pow(a + t * b, y);
      };
    }

    function gamma(y) {
      return (y = +y) === 1 ? nogamma : function(a, b) {
        return b - a ? exponential(a, b, y) : constant(isNaN(a) ? b : a);
      };
    }

    function nogamma(a, b) {
      var d = b - a;
      return d ? linear$1(a, d) : constant(isNaN(a) ? b : a);
    }

    var rgb = (function rgbGamma(y) {
      var color = gamma(y);

      function rgb(start, end) {
        var r = color((start = rgb$1(start)).r, (end = rgb$1(end)).r),
            g = color(start.g, end.g),
            b = color(start.b, end.b),
            opacity = nogamma(start.opacity, end.opacity);
        return function(t) {
          start.r = r(t);
          start.g = g(t);
          start.b = b(t);
          start.opacity = opacity(t);
          return start + "";
        };
      }

      rgb.gamma = rgbGamma;

      return rgb;
    })(1);

    function numberArray(a, b) {
      if (!b) b = [];
      var n = a ? Math.min(b.length, a.length) : 0,
          c = b.slice(),
          i;
      return function(t) {
        for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
        return c;
      };
    }

    function isNumberArray(x) {
      return ArrayBuffer.isView(x) && !(x instanceof DataView);
    }

    function genericArray(a, b) {
      var nb = b ? b.length : 0,
          na = a ? Math.min(nb, a.length) : 0,
          x = new Array(na),
          c = new Array(nb),
          i;

      for (i = 0; i < na; ++i) x[i] = interpolate(a[i], b[i]);
      for (; i < nb; ++i) c[i] = b[i];

      return function(t) {
        for (i = 0; i < na; ++i) c[i] = x[i](t);
        return c;
      };
    }

    function date(a, b) {
      var d = new Date;
      return a = +a, b = +b, function(t) {
        return d.setTime(a * (1 - t) + b * t), d;
      };
    }

    function interpolateNumber(a, b) {
      return a = +a, b = +b, function(t) {
        return a * (1 - t) + b * t;
      };
    }

    function object(a, b) {
      var i = {},
          c = {},
          k;

      if (a === null || typeof a !== "object") a = {};
      if (b === null || typeof b !== "object") b = {};

      for (k in b) {
        if (k in a) {
          i[k] = interpolate(a[k], b[k]);
        } else {
          c[k] = b[k];
        }
      }

      return function(t) {
        for (k in i) c[k] = i[k](t);
        return c;
      };
    }

    var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
        reB = new RegExp(reA.source, "g");

    function zero(b) {
      return function() {
        return b;
      };
    }

    function one(b) {
      return function(t) {
        return b(t) + "";
      };
    }

    function string(a, b) {
      var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
          am, // current match in a
          bm, // current match in b
          bs, // string preceding current number in b, if any
          i = -1, // index in s
          s = [], // string constants and placeholders
          q = []; // number interpolators

      // Coerce inputs to strings.
      a = a + "", b = b + "";

      // Interpolate pairs of numbers in a & b.
      while ((am = reA.exec(a))
          && (bm = reB.exec(b))) {
        if ((bs = bm.index) > bi) { // a string precedes the next number in b
          bs = b.slice(bi, bs);
          if (s[i]) s[i] += bs; // coalesce with previous string
          else s[++i] = bs;
        }
        if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
          if (s[i]) s[i] += bm; // coalesce with previous string
          else s[++i] = bm;
        } else { // interpolate non-matching numbers
          s[++i] = null;
          q.push({i: i, x: interpolateNumber(am, bm)});
        }
        bi = reB.lastIndex;
      }

      // Add remains of b.
      if (bi < b.length) {
        bs = b.slice(bi);
        if (s[i]) s[i] += bs; // coalesce with previous string
        else s[++i] = bs;
      }

      // Special optimization for only a single match.
      // Otherwise, interpolate each of the numbers and rejoin the string.
      return s.length < 2 ? (q[0]
          ? one(q[0].x)
          : zero(b))
          : (b = q.length, function(t) {
              for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
              return s.join("");
            });
    }

    function interpolate(a, b) {
      var t = typeof b, c;
      return b == null || t === "boolean" ? constant(b)
          : (t === "number" ? interpolateNumber
          : t === "string" ? ((c = color(b)) ? (b = c, rgb) : string)
          : b instanceof color ? rgb
          : b instanceof Date ? date
          : isNumberArray(b) ? numberArray
          : Array.isArray(b) ? genericArray
          : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
          : interpolateNumber)(a, b);
    }

    function interpolateRound(a, b) {
      return a = +a, b = +b, function(t) {
        return Math.round(a * (1 - t) + b * t);
      };
    }

    function constants(x) {
      return function() {
        return x;
      };
    }

    function number(x) {
      return +x;
    }

    var unit = [0, 1];

    function identity$1(x) {
      return x;
    }

    function normalize(a, b) {
      return (b -= (a = +a))
          ? function(x) { return (x - a) / b; }
          : constants(isNaN(b) ? NaN : 0.5);
    }

    function clamper(a, b) {
      var t;
      if (a > b) t = a, a = b, b = t;
      return function(x) { return Math.max(a, Math.min(b, x)); };
    }

    // normalize(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
    // interpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding range value x in [a,b].
    function bimap(domain, range, interpolate) {
      var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
      if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
      else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
      return function(x) { return r0(d0(x)); };
    }

    function polymap(domain, range, interpolate) {
      var j = Math.min(domain.length, range.length) - 1,
          d = new Array(j),
          r = new Array(j),
          i = -1;

      // Reverse descending domains.
      if (domain[j] < domain[0]) {
        domain = domain.slice().reverse();
        range = range.slice().reverse();
      }

      while (++i < j) {
        d[i] = normalize(domain[i], domain[i + 1]);
        r[i] = interpolate(range[i], range[i + 1]);
      }

      return function(x) {
        var i = bisect(domain, x, 1, j) - 1;
        return r[i](d[i](x));
      };
    }

    function copy(source, target) {
      return target
          .domain(source.domain())
          .range(source.range())
          .interpolate(source.interpolate())
          .clamp(source.clamp())
          .unknown(source.unknown());
    }

    function transformer() {
      var domain = unit,
          range = unit,
          interpolate$1 = interpolate,
          transform,
          untransform,
          unknown,
          clamp = identity$1,
          piecewise,
          output,
          input;

      function rescale() {
        var n = Math.min(domain.length, range.length);
        if (clamp !== identity$1) clamp = clamper(domain[0], domain[n - 1]);
        piecewise = n > 2 ? polymap : bimap;
        output = input = null;
        return scale;
      }

      function scale(x) {
        return x == null || isNaN(x = +x) ? unknown : (output || (output = piecewise(domain.map(transform), range, interpolate$1)))(transform(clamp(x)));
      }

      scale.invert = function(y) {
        return clamp(untransform((input || (input = piecewise(range, domain.map(transform), interpolateNumber)))(y)));
      };

      scale.domain = function(_) {
        return arguments.length ? (domain = Array.from(_, number), rescale()) : domain.slice();
      };

      scale.range = function(_) {
        return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
      };

      scale.rangeRound = function(_) {
        return range = Array.from(_), interpolate$1 = interpolateRound, rescale();
      };

      scale.clamp = function(_) {
        return arguments.length ? (clamp = _ ? true : identity$1, rescale()) : clamp !== identity$1;
      };

      scale.interpolate = function(_) {
        return arguments.length ? (interpolate$1 = _, rescale()) : interpolate$1;
      };

      scale.unknown = function(_) {
        return arguments.length ? (unknown = _, scale) : unknown;
      };

      return function(t, u) {
        transform = t, untransform = u;
        return rescale();
      };
    }

    function continuous() {
      return transformer()(identity$1, identity$1);
    }

    function formatDecimal(x) {
      return Math.abs(x = Math.round(x)) >= 1e21
          ? x.toLocaleString("en").replace(/,/g, "")
          : x.toString(10);
    }

    // Computes the decimal coefficient and exponent of the specified number x with
    // significant digits p, where x is positive and p is in [1, 21] or undefined.
    // For example, formatDecimalParts(1.23) returns ["123", 0].
    function formatDecimalParts(x, p) {
      if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
      var i, coefficient = x.slice(0, i);

      // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
      // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
      return [
        coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
        +x.slice(i + 1)
      ];
    }

    function exponent(x) {
      return x = formatDecimalParts(Math.abs(x)), x ? x[1] : NaN;
    }

    function formatGroup(grouping, thousands) {
      return function(value, width) {
        var i = value.length,
            t = [],
            j = 0,
            g = grouping[0],
            length = 0;

        while (i > 0 && g > 0) {
          if (length + g + 1 > width) g = Math.max(1, width - length);
          t.push(value.substring(i -= g, i + g));
          if ((length += g + 1) > width) break;
          g = grouping[j = (j + 1) % grouping.length];
        }

        return t.reverse().join(thousands);
      };
    }

    function formatNumerals(numerals) {
      return function(value) {
        return value.replace(/[0-9]/g, function(i) {
          return numerals[+i];
        });
      };
    }

    // [[fill]align][sign][symbol][0][width][,][.precision][~][type]
    var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

    function formatSpecifier(specifier) {
      if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
      var match;
      return new FormatSpecifier({
        fill: match[1],
        align: match[2],
        sign: match[3],
        symbol: match[4],
        zero: match[5],
        width: match[6],
        comma: match[7],
        precision: match[8] && match[8].slice(1),
        trim: match[9],
        type: match[10]
      });
    }

    formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

    function FormatSpecifier(specifier) {
      this.fill = specifier.fill === undefined ? " " : specifier.fill + "";
      this.align = specifier.align === undefined ? ">" : specifier.align + "";
      this.sign = specifier.sign === undefined ? "-" : specifier.sign + "";
      this.symbol = specifier.symbol === undefined ? "" : specifier.symbol + "";
      this.zero = !!specifier.zero;
      this.width = specifier.width === undefined ? undefined : +specifier.width;
      this.comma = !!specifier.comma;
      this.precision = specifier.precision === undefined ? undefined : +specifier.precision;
      this.trim = !!specifier.trim;
      this.type = specifier.type === undefined ? "" : specifier.type + "";
    }

    FormatSpecifier.prototype.toString = function() {
      return this.fill
          + this.align
          + this.sign
          + this.symbol
          + (this.zero ? "0" : "")
          + (this.width === undefined ? "" : Math.max(1, this.width | 0))
          + (this.comma ? "," : "")
          + (this.precision === undefined ? "" : "." + Math.max(0, this.precision | 0))
          + (this.trim ? "~" : "")
          + this.type;
    };

    // Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
    function formatTrim(s) {
      out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
        switch (s[i]) {
          case ".": i0 = i1 = i; break;
          case "0": if (i0 === 0) i0 = i; i1 = i; break;
          default: if (!+s[i]) break out; if (i0 > 0) i0 = 0; break;
        }
      }
      return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
    }

    var prefixExponent;

    function formatPrefixAuto(x, p) {
      var d = formatDecimalParts(x, p);
      if (!d) return x + "";
      var coefficient = d[0],
          exponent = d[1],
          i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
          n = coefficient.length;
      return i === n ? coefficient
          : i > n ? coefficient + new Array(i - n + 1).join("0")
          : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
          : "0." + new Array(1 - i).join("0") + formatDecimalParts(x, Math.max(0, p + i - 1))[0]; // less than 1y!
    }

    function formatRounded(x, p) {
      var d = formatDecimalParts(x, p);
      if (!d) return x + "";
      var coefficient = d[0],
          exponent = d[1];
      return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
          : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
          : coefficient + new Array(exponent - coefficient.length + 2).join("0");
    }

    var formatTypes = {
      "%": (x, p) => (x * 100).toFixed(p),
      "b": (x) => Math.round(x).toString(2),
      "c": (x) => x + "",
      "d": formatDecimal,
      "e": (x, p) => x.toExponential(p),
      "f": (x, p) => x.toFixed(p),
      "g": (x, p) => x.toPrecision(p),
      "o": (x) => Math.round(x).toString(8),
      "p": (x, p) => formatRounded(x * 100, p),
      "r": formatRounded,
      "s": formatPrefixAuto,
      "X": (x) => Math.round(x).toString(16).toUpperCase(),
      "x": (x) => Math.round(x).toString(16)
    };

    function identity(x) {
      return x;
    }

    var map = Array.prototype.map,
        prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

    function formatLocale(locale) {
      var group = locale.grouping === undefined || locale.thousands === undefined ? identity : formatGroup(map.call(locale.grouping, Number), locale.thousands + ""),
          currencyPrefix = locale.currency === undefined ? "" : locale.currency[0] + "",
          currencySuffix = locale.currency === undefined ? "" : locale.currency[1] + "",
          decimal = locale.decimal === undefined ? "." : locale.decimal + "",
          numerals = locale.numerals === undefined ? identity : formatNumerals(map.call(locale.numerals, String)),
          percent = locale.percent === undefined ? "%" : locale.percent + "",
          minus = locale.minus === undefined ? "−" : locale.minus + "",
          nan = locale.nan === undefined ? "NaN" : locale.nan + "";

      function newFormat(specifier) {
        specifier = formatSpecifier(specifier);

        var fill = specifier.fill,
            align = specifier.align,
            sign = specifier.sign,
            symbol = specifier.symbol,
            zero = specifier.zero,
            width = specifier.width,
            comma = specifier.comma,
            precision = specifier.precision,
            trim = specifier.trim,
            type = specifier.type;

        // The "n" type is an alias for ",g".
        if (type === "n") comma = true, type = "g";

        // The "" type, and any invalid type, is an alias for ".12~g".
        else if (!formatTypes[type]) precision === undefined && (precision = 12), trim = true, type = "g";

        // If zero fill is specified, padding goes after sign and before digits.
        if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

        // Compute the prefix and suffix.
        // For SI-prefix, the suffix is lazily computed.
        var prefix = symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
            suffix = symbol === "$" ? currencySuffix : /[%p]/.test(type) ? percent : "";

        // What format function should we use?
        // Is this an integer type?
        // Can this type generate exponential notation?
        var formatType = formatTypes[type],
            maybeSuffix = /[defgprs%]/.test(type);

        // Set the default precision if not specified,
        // or clamp the specified precision to the supported range.
        // For significant precision, it must be in [1, 21].
        // For fixed precision, it must be in [0, 20].
        precision = precision === undefined ? 6
            : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
            : Math.max(0, Math.min(20, precision));

        function format(value) {
          var valuePrefix = prefix,
              valueSuffix = suffix,
              i, n, c;

          if (type === "c") {
            valueSuffix = formatType(value) + valueSuffix;
            value = "";
          } else {
            value = +value;

            // Determine the sign. -0 is not less than 0, but 1 / -0 is!
            var valueNegative = value < 0 || 1 / value < 0;

            // Perform the initial formatting.
            value = isNaN(value) ? nan : formatType(Math.abs(value), precision);

            // Trim insignificant zeros.
            if (trim) value = formatTrim(value);

            // If a negative value rounds to zero after formatting, and no explicit positive sign is requested, hide the sign.
            if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;

            // Compute the prefix and suffix.
            valuePrefix = (valueNegative ? (sign === "(" ? sign : minus) : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
            valueSuffix = (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

            // Break the formatted value into the integer “value” part that can be
            // grouped, and fractional or exponential “suffix” part that is not.
            if (maybeSuffix) {
              i = -1, n = value.length;
              while (++i < n) {
                if (c = value.charCodeAt(i), 48 > c || c > 57) {
                  valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
                  value = value.slice(0, i);
                  break;
                }
              }
            }
          }

          // If the fill character is not "0", grouping is applied before padding.
          if (comma && !zero) value = group(value, Infinity);

          // Compute the padding.
          var length = valuePrefix.length + value.length + valueSuffix.length,
              padding = length < width ? new Array(width - length + 1).join(fill) : "";

          // If the fill character is "0", grouping is applied after padding.
          if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

          // Reconstruct the final output based on the desired alignment.
          switch (align) {
            case "<": value = valuePrefix + value + valueSuffix + padding; break;
            case "=": value = valuePrefix + padding + value + valueSuffix; break;
            case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
            default: value = padding + valuePrefix + value + valueSuffix; break;
          }

          return numerals(value);
        }

        format.toString = function() {
          return specifier + "";
        };

        return format;
      }

      function formatPrefix(specifier, value) {
        var f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
            e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
            k = Math.pow(10, -e),
            prefix = prefixes[8 + e / 3];
        return function(value) {
          return f(k * value) + prefix;
        };
      }

      return {
        format: newFormat,
        formatPrefix: formatPrefix
      };
    }

    var locale;
    var format;
    var formatPrefix;

    defaultLocale({
      thousands: ",",
      grouping: [3],
      currency: ["$", ""]
    });

    function defaultLocale(definition) {
      locale = formatLocale(definition);
      format = locale.format;
      formatPrefix = locale.formatPrefix;
      return locale;
    }

    function precisionFixed(step) {
      return Math.max(0, -exponent(Math.abs(step)));
    }

    function precisionPrefix(step, value) {
      return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
    }

    function precisionRound(step, max) {
      step = Math.abs(step), max = Math.abs(max) - step;
      return Math.max(0, exponent(max) - exponent(step)) + 1;
    }

    function tickFormat(start, stop, count, specifier) {
      var step = tickStep(start, stop, count),
          precision;
      specifier = formatSpecifier(specifier == null ? ",f" : specifier);
      switch (specifier.type) {
        case "s": {
          var value = Math.max(Math.abs(start), Math.abs(stop));
          if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
          return formatPrefix(specifier, value);
        }
        case "":
        case "e":
        case "g":
        case "p":
        case "r": {
          if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
          break;
        }
        case "f":
        case "%": {
          if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
          break;
        }
      }
      return format(specifier);
    }

    function linearish(scale) {
      var domain = scale.domain;

      scale.ticks = function(count) {
        var d = domain();
        return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
      };

      scale.tickFormat = function(count, specifier) {
        var d = domain();
        return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
      };

      scale.nice = function(count) {
        if (count == null) count = 10;

        var d = domain();
        var i0 = 0;
        var i1 = d.length - 1;
        var start = d[i0];
        var stop = d[i1];
        var prestep;
        var step;
        var maxIter = 10;

        if (stop < start) {
          step = start, start = stop, stop = step;
          step = i0, i0 = i1, i1 = step;
        }
        
        while (maxIter-- > 0) {
          step = tickIncrement(start, stop, count);
          if (step === prestep) {
            d[i0] = start;
            d[i1] = stop;
            return domain(d);
          } else if (step > 0) {
            start = Math.floor(start / step) * step;
            stop = Math.ceil(stop / step) * step;
          } else if (step < 0) {
            start = Math.ceil(start * step) / step;
            stop = Math.floor(stop * step) / step;
          } else {
            break;
          }
          prestep = step;
        }

        return scale;
      };

      return scale;
    }

    function linear() {
      var scale = continuous();

      scale.copy = function() {
        return copy(scale, linear());
      };

      initRange.apply(scale, arguments);

      return linearish(scale);
    }

    /* src/components/RadialWaterfall.svelte generated by Svelte v3.59.2 */
    const file$3 = "src/components/RadialWaterfall.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[22] = list[i];
    	child_ctx[26] = i;
    	const constants_0 = /*monthAngles*/ child_ctx[14](/*entry*/ child_ctx[22].date);
    	child_ctx[23] = constants_0.start;
    	child_ctx[24] = constants_0.end;
    	return child_ctx;
    }

    // (59:0) {#if radiusScale}
    function create_if_block$2(ctx) {
    	let svg;
    	let g;
    	let monthspokes;
    	let radialaxis;
    	let g_transform_value;
    	let svg_viewBox_value;
    	let current;

    	monthspokes = new MonthSpokes({
    			props: {
    				count: 12,
    				radius: /*chartSize*/ ctx[5] / 2 - padding,
    				labels: [
    					'Jan',
    					'Feb',
    					'Mar',
    					'Apr',
    					'May',
    					'Jun',
    					'Jul',
    					'Aug',
    					'Sep',
    					'Oct',
    					'Nov',
    					'Dec'
    				],
    				spokeColor: /*colorText2*/ ctx[7],
    				labelColor: /*colorText1*/ ctx[6],
    				fontSize: /*labelSize*/ ctx[13]
    			},
    			$$inline: true
    		});

    	radialaxis = new RadialAxis({
    			props: {
    				scale: /*radiusScale*/ ctx[12],
    				cx: 0,
    				cy: 0,
    				tickCount: 6,
    				subCount: 2,
    				strokeColor: /*colorText1*/ ctx[6],
    				minorColor: /*colorText2*/ ctx[7],
    				labelColor: /*colorText1*/ ctx[6],
    				axisLabel: "Jump Height (m)",
    				fontSize: /*labelSize*/ ctx[13]
    			},
    			$$inline: true
    		});

    	let each_value = /*entries*/ ctx[1].slice(0, /*step*/ ctx[0] + 1);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g = svg_element("g");
    			create_component(monthspokes.$$.fragment);
    			create_component(radialaxis.$$.fragment);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(g, "transform", g_transform_value = `translate(${/*chartSize*/ ctx[5] / 2},${/*chartSize*/ ctx[5] / 2})`);
    			add_location(g, file$3, 64, 4, 1991);
    			attr_dev(svg, "width", /*chartSize*/ ctx[5]);
    			attr_dev(svg, "height", /*chartSize*/ ctx[5]);
    			attr_dev(svg, "viewBox", svg_viewBox_value = `0 0 ${/*chartSize*/ ctx[5]} ${/*chartSize*/ ctx[5]}`);
    			attr_dev(svg, "class", "svelte-11b5lpy");
    			add_location(svg, file$3, 59, 2, 1887);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g);
    			mount_component(monthspokes, g, null);
    			mount_component(radialaxis, g, null);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(g, null);
    				}
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const monthspokes_changes = {};
    			if (dirty & /*chartSize*/ 32) monthspokes_changes.radius = /*chartSize*/ ctx[5] / 2 - padding;
    			if (dirty & /*colorText2*/ 128) monthspokes_changes.spokeColor = /*colorText2*/ ctx[7];
    			if (dirty & /*colorText1*/ 64) monthspokes_changes.labelColor = /*colorText1*/ ctx[6];
    			if (dirty & /*labelSize*/ 8192) monthspokes_changes.fontSize = /*labelSize*/ ctx[13];
    			monthspokes.$set(monthspokes_changes);
    			const radialaxis_changes = {};
    			if (dirty & /*radiusScale*/ 4096) radialaxis_changes.scale = /*radiusScale*/ ctx[12];
    			if (dirty & /*colorText1*/ 64) radialaxis_changes.strokeColor = /*colorText1*/ ctx[6];
    			if (dirty & /*colorText2*/ 128) radialaxis_changes.minorColor = /*colorText2*/ ctx[7];
    			if (dirty & /*colorText1*/ 64) radialaxis_changes.labelColor = /*colorText1*/ ctx[6];
    			if (dirty & /*labelSize*/ 8192) radialaxis_changes.fontSize = /*labelSize*/ ctx[13];
    			radialaxis.$set(radialaxis_changes);

    			if (dirty & /*radiusScale, entries, step, gender, monthAngles, colorStrokeMen, colorStrokeWomen, colorFillMen, colorFillWomen*/ 24327) {
    				each_value = /*entries*/ ctx[1].slice(0, /*step*/ ctx[0] + 1);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(g, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty & /*chartSize*/ 32 && g_transform_value !== (g_transform_value = `translate(${/*chartSize*/ ctx[5] / 2},${/*chartSize*/ ctx[5] / 2})`)) {
    				attr_dev(g, "transform", g_transform_value);
    			}

    			if (!current || dirty & /*chartSize*/ 32) {
    				attr_dev(svg, "width", /*chartSize*/ ctx[5]);
    			}

    			if (!current || dirty & /*chartSize*/ 32) {
    				attr_dev(svg, "height", /*chartSize*/ ctx[5]);
    			}

    			if (!current || dirty & /*chartSize*/ 32 && svg_viewBox_value !== (svg_viewBox_value = `0 0 ${/*chartSize*/ ctx[5]} ${/*chartSize*/ ctx[5]}`)) {
    				attr_dev(svg, "viewBox", svg_viewBox_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(monthspokes.$$.fragment, local);
    			transition_in(radialaxis.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(monthspokes.$$.fragment, local);
    			transition_out(radialaxis.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			destroy_component(monthspokes);
    			destroy_component(radialaxis);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(59:0) {#if radiusScale}",
    		ctx
    	});

    	return block;
    }

    // (92:6) {#each entries.slice(0, step+1) as entry, i}
    function create_each_block$1(ctx) {
    	let monthpath;
    	let current;

    	monthpath = new MonthPath({
    			props: {
    				innerRadius: /*radiusScale*/ ctx[12](/*entry*/ ctx[22][/*gender*/ ctx[2] + 'Prev']),
    				outerRadius: /*radiusScale*/ ctx[12](/*entry*/ ctx[22][/*gender*/ ctx[2] + 'H']),
    				startAngle: /*start*/ ctx[23],
    				endAngle: /*end*/ ctx[24],
    				color: /*gender*/ ctx[2] === 'men'
    				? /*colorStrokeMen*/ ctx[9]
    				: /*colorStrokeWomen*/ ctx[11],
    				fillColor: /*gender*/ ctx[2] === 'men'
    				? /*colorFillMen*/ ctx[8]
    				: /*colorFillWomen*/ ctx[10],
    				selected: /*i*/ ctx[26] === /*step*/ ctx[0] && !!/*entry*/ ctx[22][/*gender*/ ctx[2] + 'Annotation'],
    				current: /*i*/ ctx[26] === /*step*/ ctx[0] && !/*entry*/ ctx[22][/*gender*/ ctx[2] + 'Annotation']
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(monthpath.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(monthpath, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const monthpath_changes = {};
    			if (dirty & /*radiusScale, entries, step, gender*/ 4103) monthpath_changes.innerRadius = /*radiusScale*/ ctx[12](/*entry*/ ctx[22][/*gender*/ ctx[2] + 'Prev']);
    			if (dirty & /*radiusScale, entries, step, gender*/ 4103) monthpath_changes.outerRadius = /*radiusScale*/ ctx[12](/*entry*/ ctx[22][/*gender*/ ctx[2] + 'H']);
    			if (dirty & /*entries, step*/ 3) monthpath_changes.startAngle = /*start*/ ctx[23];
    			if (dirty & /*entries, step*/ 3) monthpath_changes.endAngle = /*end*/ ctx[24];

    			if (dirty & /*gender, colorStrokeMen, colorStrokeWomen*/ 2564) monthpath_changes.color = /*gender*/ ctx[2] === 'men'
    			? /*colorStrokeMen*/ ctx[9]
    			: /*colorStrokeWomen*/ ctx[11];

    			if (dirty & /*gender, colorFillMen, colorFillWomen*/ 1284) monthpath_changes.fillColor = /*gender*/ ctx[2] === 'men'
    			? /*colorFillMen*/ ctx[8]
    			: /*colorFillWomen*/ ctx[10];

    			if (dirty & /*step, entries, gender*/ 7) monthpath_changes.selected = /*i*/ ctx[26] === /*step*/ ctx[0] && !!/*entry*/ ctx[22][/*gender*/ ctx[2] + 'Annotation'];
    			if (dirty & /*step, entries, gender*/ 7) monthpath_changes.current = /*i*/ ctx[26] === /*step*/ ctx[0] && !/*entry*/ ctx[22][/*gender*/ ctx[2] + 'Annotation'];
    			monthpath.$set(monthpath_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(monthpath.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(monthpath.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(monthpath, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(92:6) {#each entries.slice(0, step+1) as entry, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	add_render_callback(/*onwindowresize*/ ctx[15]);
    	let if_block = /*radiusScale*/ ctx[12] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window, "resize", /*onwindowresize*/ ctx[15]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*radiusScale*/ ctx[12]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*radiusScale*/ 4096) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const padding = 50;

    function instance$3($$self, $$props, $$invalidate) {
    	let chartSize;
    	let labelSize;
    	let heightField;
    	let radiusScale;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('RadialWaterfall', slots, []);
    	let { step = 0 } = $$props;
    	let { entries = [] } = $$props;
    	let { gender = 'men' } = $$props;

    	// Sizing
    	let innerWidth = 0;

    	let innerHeight = 0;
    	let plotHeightRatio = 4 / 5;

    	let colorText1,
    		colorText2,
    		colorFillMen,
    		colorStrokeMen,
    		colorFillWomen,
    		colorStrokeWomen,
    		colorFillHighlight,
    		colorStrokeHighlight;

    	const styles = getComputedStyle(document.documentElement);
    	colorText1 = styles.getPropertyValue('--color-text-1').trim();
    	colorText2 = styles.getPropertyValue('--color-text-2').trim();
    	colorFillMen = styles.getPropertyValue('--color-men-fill').trim();
    	colorStrokeMen = styles.getPropertyValue('--color-men-stroke').trim();
    	colorFillWomen = styles.getPropertyValue('--color-women-fill').trim();
    	colorStrokeWomen = styles.getPropertyValue('--color-women-stroke').trim();
    	colorFillHighlight = styles.getPropertyValue('--color-highlight-fill').trim();
    	colorStrokeHighlight = styles.getPropertyValue('--color-highlight-stroke').trim();
    	const TWO_PI = 2 * Math.PI;

    	function monthAngles(date) {
    		const m = date.getMonth();

    		return {
    			start: m / 12 * TWO_PI, // - Math.PI/2,
    			end: (m + 1) / 12 * TWO_PI, // - Math.PI/2
    			
    		};
    	}

    	const writable_props = ['step', 'entries', 'gender'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<RadialWaterfall> was created with unknown prop '${key}'`);
    	});

    	function onwindowresize() {
    		$$invalidate(3, innerWidth = window.innerWidth);
    		$$invalidate(4, innerHeight = window.innerHeight);
    	}

    	$$self.$$set = $$props => {
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('entries' in $$props) $$invalidate(1, entries = $$props.entries);
    		if ('gender' in $$props) $$invalidate(2, gender = $$props.gender);
    	};

    	$$self.$capture_state = () => ({
    		MonthPath,
    		RadialAxis,
    		MonthSpokes,
    		scaleLinear: linear,
    		max: max$1,
    		step,
    		entries,
    		gender,
    		innerWidth,
    		innerHeight,
    		plotHeightRatio,
    		padding,
    		colorText1,
    		colorText2,
    		colorFillMen,
    		colorStrokeMen,
    		colorFillWomen,
    		colorStrokeWomen,
    		colorFillHighlight,
    		colorStrokeHighlight,
    		styles,
    		TWO_PI,
    		monthAngles,
    		chartSize,
    		radiusScale,
    		heightField,
    		labelSize
    	});

    	$$self.$inject_state = $$props => {
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('entries' in $$props) $$invalidate(1, entries = $$props.entries);
    		if ('gender' in $$props) $$invalidate(2, gender = $$props.gender);
    		if ('innerWidth' in $$props) $$invalidate(3, innerWidth = $$props.innerWidth);
    		if ('innerHeight' in $$props) $$invalidate(4, innerHeight = $$props.innerHeight);
    		if ('plotHeightRatio' in $$props) $$invalidate(19, plotHeightRatio = $$props.plotHeightRatio);
    		if ('colorText1' in $$props) $$invalidate(6, colorText1 = $$props.colorText1);
    		if ('colorText2' in $$props) $$invalidate(7, colorText2 = $$props.colorText2);
    		if ('colorFillMen' in $$props) $$invalidate(8, colorFillMen = $$props.colorFillMen);
    		if ('colorStrokeMen' in $$props) $$invalidate(9, colorStrokeMen = $$props.colorStrokeMen);
    		if ('colorFillWomen' in $$props) $$invalidate(10, colorFillWomen = $$props.colorFillWomen);
    		if ('colorStrokeWomen' in $$props) $$invalidate(11, colorStrokeWomen = $$props.colorStrokeWomen);
    		if ('colorFillHighlight' in $$props) colorFillHighlight = $$props.colorFillHighlight;
    		if ('colorStrokeHighlight' in $$props) colorStrokeHighlight = $$props.colorStrokeHighlight;
    		if ('chartSize' in $$props) $$invalidate(5, chartSize = $$props.chartSize);
    		if ('radiusScale' in $$props) $$invalidate(12, radiusScale = $$props.radiusScale);
    		if ('heightField' in $$props) heightField = $$props.heightField;
    		if ('labelSize' in $$props) $$invalidate(13, labelSize = $$props.labelSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*innerWidth, innerHeight*/ 24) {
    			$$invalidate(5, chartSize = Math.min(innerWidth, innerHeight * plotHeightRatio));
    		}

    		if ($$self.$$.dirty & /*chartSize*/ 32) {
    			$$invalidate(13, labelSize = chartSize * 0.02); // 4% of chart width
    		}

    		if ($$self.$$.dirty & /*gender*/ 4) {
    			// what gender are we plotting?
    			heightField = gender === 'men' ? 'menH' : 'womenH';
    		}

    		if ($$self.$$.dirty & /*entries, chartSize*/ 34) {
    			$$invalidate(12, radiusScale = entries.length
    			? linear().domain([0, max$1(entries, e => e.menH)]).nice(5).range([0, chartSize / 2 - padding])
    			: null); // Hardcoded to men scale
    		}
    	};

    	return [
    		step,
    		entries,
    		gender,
    		innerWidth,
    		innerHeight,
    		chartSize,
    		colorText1,
    		colorText2,
    		colorFillMen,
    		colorStrokeMen,
    		colorFillWomen,
    		colorStrokeWomen,
    		radiusScale,
    		labelSize,
    		monthAngles,
    		onwindowresize
    	];
    }

    class RadialWaterfall extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { step: 0, entries: 1, gender: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RadialWaterfall",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get step() {
    		throw new Error("<RadialWaterfall>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set step(value) {
    		throw new Error("<RadialWaterfall>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get entries() {
    		throw new Error("<RadialWaterfall>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set entries(value) {
    		throw new Error("<RadialWaterfall>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get gender() {
    		throw new Error("<RadialWaterfall>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set gender(value) {
    		throw new Error("<RadialWaterfall>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Scrolly.svelte generated by Svelte v3.59.2 */
    const file$2 = "src/components/Scrolly.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			add_location(div, file$2, 80, 0, 1967);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			/*div_binding*/ ctx[8](div);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			/*div_binding*/ ctx[8](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Scrolly', slots, ['default']);
    	let { root = null } = $$props;
    	let { top = 0 } = $$props;
    	let { bottom = 0 } = $$props;
    	let { increments = 100 } = $$props;
    	let { value = undefined } = $$props;
    	const steps = [];
    	const threshold = [];
    	let nodes = [];
    	let intersectionObservers = [];
    	let container;

    	const update = () => {
    		if (!nodes.length) return;
    		nodes.forEach(createObserver);
    	};

    	const mostInView = () => {
    		let maxRatio = 0;
    		let maxIndex = 0;

    		for (let i = 0; i < steps.length; i++) {
    			if (steps[i] > maxRatio) {
    				maxRatio = steps[i];
    				maxIndex = i;
    			}
    		}

    		if (maxRatio > 0) $$invalidate(1, value = maxIndex); else $$invalidate(1, value = undefined);
    	};

    	const createObserver = (node, index) => {
    		const handleIntersect = e => {
    			e[0].isIntersecting;
    			const ratio = e[0].intersectionRatio;
    			steps[index] = ratio;
    			mostInView();
    		};

    		const marginTop = top ? top * -1 : 0;
    		const marginBottom = bottom ? bottom * -1 : 0;
    		const rootMargin = `${marginTop}px 0px ${marginBottom}px 0px`;
    		const options = { root, rootMargin, threshold };
    		if (intersectionObservers[index]) intersectionObservers[index].disconnect();
    		const io = new IntersectionObserver(handleIntersect, options);
    		io.observe(node);
    		intersectionObservers[index] = io;
    	};

    	onMount(() => {
    		for (let i = 0; i < increments + 1; i++) {
    			threshold.push(i / increments);
    		}

    		nodes = container.querySelectorAll(":scope > *");
    		update();
    	});

    	const writable_props = ['root', 'top', 'bottom', 'increments', 'value'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Scrolly> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			container = $$value;
    			$$invalidate(0, container);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('root' in $$props) $$invalidate(2, root = $$props.root);
    		if ('top' in $$props) $$invalidate(3, top = $$props.top);
    		if ('bottom' in $$props) $$invalidate(4, bottom = $$props.bottom);
    		if ('increments' in $$props) $$invalidate(5, increments = $$props.increments);
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('$$scope' in $$props) $$invalidate(6, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		root,
    		top,
    		bottom,
    		increments,
    		value,
    		steps,
    		threshold,
    		nodes,
    		intersectionObservers,
    		container,
    		update,
    		mostInView,
    		createObserver
    	});

    	$$self.$inject_state = $$props => {
    		if ('root' in $$props) $$invalidate(2, root = $$props.root);
    		if ('top' in $$props) $$invalidate(3, top = $$props.top);
    		if ('bottom' in $$props) $$invalidate(4, bottom = $$props.bottom);
    		if ('increments' in $$props) $$invalidate(5, increments = $$props.increments);
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('nodes' in $$props) nodes = $$props.nodes;
    		if ('intersectionObservers' in $$props) intersectionObservers = $$props.intersectionObservers;
    		if ('container' in $$props) $$invalidate(0, container = $$props.container);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*top, bottom*/ 24) {
    			(update());
    		}
    	};

    	return [container, value, root, top, bottom, increments, $$scope, slots, div_binding];
    }

    class Scrolly extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			root: 2,
    			top: 3,
    			bottom: 4,
    			increments: 5,
    			value: 1
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Scrolly",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get root() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set root(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get top() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set top(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bottom() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bottom(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get increments() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set increments(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const annotationMap = {
         '2013-11': {
            men: '',
            women: ''
        },
        '2013-12': {
            men: 'Setting the first monthly WOO leaderboard record, Blaire H hits 5.8m, about as high as the walls on a two story house.',
            women: ''
        },
        '2015-01': {
            men: "The UK's Lewis Crathern, future 2016 Vice Big Air World Champion, is first to break 15m, jumping about as high as the length of two London Buses end-to-end.",
            women: ''
        },
        '2015-06': {
            men: "Fluid Kiteboarding owner, Gilion Goveia, is the first to break 20m using his own brand's kite, a 6m Fluid ATV, a huge milestone in record progression.",
            women: ''
        },
        // '2017-11': {
        //     men: "His third entry into the record books, South Africa's Joshua Emanuel comes up just shy of the 30m mark, hitting 29m in Cape Town.",
        //     women: ''
        // }
        '2018-11': {
            men: "Mirroring his 2015 record of 19.1 m, Dutch-born Gijs Wassenaar flies just shy of a milestone 30 m in Zandvoort, Netherlands, with a 29.6 m effort...",
            women: ''
        },
        '2019-01': {
            men: "However, that threshold is quickly smashed by fellow Dutchman, Maarten Haeger, reaching a staggering 32 m in the Big Air mecca of Misty Cliffs, Cape Town.",
            women: ''
        },
        '2019-11': {
            men: "A flurry of new records are set at the tail end of 2019 and into 2020, with Maarten Haeger and Mike 'GetHighWithMike' MacDonald trading new heights towards 35 m, off the shorelines of Cape Town...",
            women: ''
        },
        '2020-01': {
            men: "With Maarten reclaiming his title in January 2020, hitting 34.8m ...",
            women: "Ending Karen Hou's 9-record-long streak, Lithuanian Gabby Pioraite enters the leaderboards, extending the record towards 25, at 23.6m at Kite Beach."
        },
        // '2020-01': {
        //     men: "... with Maarten coming up just short at 34.8 m in January of 2020.",
        //     women: ''
        // },
        '2020-08': {
            men: "A record that would stand...",
            women: ''
        },
        '2021-03': {
            men: "For three...",
            women: ''
        },
        '2021-10': {
            men: "... entire...",
            women: "But as sure as the sun will rise, and the wind will blow, Karen Hou returns, just 0.4m short of 25m in her home waters of Longmen Beach in Penghu Island."
        },
        '2022-05': {
            men: "... years...",
            women: ''
        },
        '2023-01': {
            men: "... with the 35 m barrier finally being broken by the Netherlands' Jamie Overbeek.",
            women: ''
        },
        '2023-08': {
            men: "With his fourth entry into the record books, Joshua Emanuel is the first to break 36m, soaring 11 stories high at 36.2m...",
            women: ''
        },
        '2024-09': {
            men: "A record that stands for just over a year, when the young Kiwi, Hugo Wigglesworth, hits 36.7m where the record stands today.",
            women: ''
        },


        '2015-01': {
            men: '',
            women: "Kicking off the women's leaderboard, Tina Jerke sets a solid foundation of 7.9m in January 2015..."
        },
        '2015-02': {
            men: '',
            women: "A record almost instantly broken by Gerdian Mjnten, smashing through 10m to a 13.9m height - imagine a large shipping container, longways-up - higher than that."
        },
        '2015-10': {
            men: '',
            women: "October 2015, enter Jia Lin 'Karen' Hou from Penghu Island, Taiwan, breaking the 15m barrier at 15.6m. Remember this name."
        },
        '2018-01': {
            men: '',
            women: "Already her 7th entry into the record books, Karen Hou breaks the 20m barrier on the famous Kite Beach in Cape Town, breaking her own record for the 6th time at 20.5m."
        },
        '2022-11': {
            men: '',
            women: "November 2022, the 25m barrier is finally broken by France's Angely Bouillot, reaching 25.1m in the Misty Cliff waters of Cape Town. Here is another one to remember."
        },
        '2023-12': {
            men: '',
            women: "Over a year after her previous record, Angely sets another, again smashing through a milestone, this time 30m. The 32.6m jump brings the womens leaderboard within the range of the mens, an unsurprising achievement from Bouillot, the only female competitor to ever ride in Red Bull's 'King of the Air' event, inspiring the introduction of a Women's category. This massive 32.6m jump, the largest single increase in the women's leaderboard, is where the record stands today.",
        },

    };

    /* src/components/CurrentInfo.svelte generated by Svelte v3.59.2 */

    const file$1 = "src/components/CurrentInfo.svelte";

    // (7:4) {#if monthLabel}
    function create_if_block_4(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "current-month");
    			add_location(div, file$1, 7, 8, 139);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(7:4) {#if monthLabel}",
    		ctx
    	});

    	return block;
    }

    // (14:8) {:else}
    function create_else_block$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "No record yet";
    			attr_dev(div, "class", "no-record svelte-lpluel");
    			add_location(div, file$1, 14, 12, 366);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(14:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (11:8) {#if record}
    function create_if_block_3(ctx) {
    	let div0;
    	let t0_value = /*record*/ ctx[1].height + "";
    	let t0;
    	let t1;
    	let t2;
    	let div1;
    	let t3_value = /*record*/ ctx[1].name + "";
    	let t3;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = text$1(t0_value);
    			t1 = text$1(" m");
    			t2 = space();
    			div1 = element("div");
    			t3 = text$1(t3_value);
    			attr_dev(div0, "class", "height svelte-lpluel");
    			add_location(div0, file$1, 11, 12, 244);
    			attr_dev(div1, "class", "name svelte-lpluel");
    			add_location(div1, file$1, 12, 12, 300);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*record*/ 2 && t0_value !== (t0_value = /*record*/ ctx[1].height + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*record*/ 2 && t3_value !== (t3_value = /*record*/ ctx[1].name + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(11:8) {#if record}",
    		ctx
    	});

    	return block;
    }

    // (21:8) {#if record}
    function create_if_block$1(ctx) {
    	let div0;
    	let t;
    	let div1;
    	let if_block0 = /*record*/ ctx[1].kiteBrand !== 'null' && create_if_block_2(ctx);
    	let if_block1 = /*record*/ ctx[1].location !== 'null' && create_if_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t = space();
    			div1 = element("div");
    			if (if_block1) if_block1.c();
    			attr_dev(div0, "class", "kite svelte-lpluel");
    			add_location(div0, file$1, 21, 8, 522);
    			attr_dev(div1, "class", "location svelte-lpluel");
    			add_location(div1, file$1, 26, 12, 735);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			if (if_block0) if_block0.m(div0, null);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div1, anchor);
    			if (if_block1) if_block1.m(div1, null);
    		},
    		p: function update(ctx, dirty) {
    			if (/*record*/ ctx[1].kiteBrand !== 'null') {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*record*/ ctx[1].location !== 'null') {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (if_block0) if_block0.d();
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div1);
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(21:8) {#if record}",
    		ctx
    	});

    	return block;
    }

    // (23:16) {#if record.kiteBrand !== 'null'}
    function create_if_block_2(ctx) {
    	let t0_value = /*record*/ ctx[1].kiteSize + "";
    	let t0;
    	let t1;
    	let sup;
    	let t3_value = /*record*/ ctx[1].kiteBrand + ' ' + /*record*/ ctx[1].kiteModel + "";
    	let t3;

    	const block = {
    		c: function create() {
    			t0 = text$1(t0_value);
    			t1 = text$1("m");
    			sup = element("sup");
    			sup.textContent = "2 ";
    			t3 = text$1(t3_value);
    			add_location(sup, file$1, 23, 38, 629);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, sup, anchor);
    			insert_dev(target, t3, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*record*/ 2 && t0_value !== (t0_value = /*record*/ ctx[1].kiteSize + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*record*/ 2 && t3_value !== (t3_value = /*record*/ ctx[1].kiteBrand + ' ' + /*record*/ ctx[1].kiteModel + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(sup);
    			if (detaching) detach_dev(t3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(23:16) {#if record.kiteBrand !== 'null'}",
    		ctx
    	});

    	return block;
    }

    // (28:16) {#if record.location !== 'null'}
    function create_if_block_1$1(ctx) {
    	let t0_value = /*record*/ ctx[1].location + "";
    	let t0;
    	let t1;
    	let t2_value = /*record*/ ctx[1].country + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text$1(t0_value);
    			t1 = text$1(", ");
    			t2 = text$1(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*record*/ 2 && t0_value !== (t0_value = /*record*/ ctx[1].location + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*record*/ 2 && t2_value !== (t2_value = /*record*/ ctx[1].country + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(28:16) {#if record.location !== 'null'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div2;
    	let t0;
    	let div0;
    	let t1;
    	let div1;
    	let if_block0 = /*monthLabel*/ ctx[0] && create_if_block_4(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*record*/ ctx[1]) return create_if_block_3;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);
    	let if_block2 = /*record*/ ctx[1] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			div0 = element("div");
    			if_block1.c();
    			t1 = space();
    			div1 = element("div");
    			if (if_block2) if_block2.c();
    			attr_dev(div0, "class", "info-left svelte-lpluel");
    			add_location(div0, file$1, 9, 4, 187);
    			attr_dev(div1, "class", "info-right svelte-lpluel");
    			add_location(div1, file$1, 19, 4, 468);
    			attr_dev(div2, "class", "current-info svelte-lpluel");
    			add_location(div2, file$1, 5, 0, 83);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			if (if_block0) if_block0.m(div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div0);
    			if_block1.m(div0, null);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			if (if_block2) if_block2.m(div1, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*monthLabel*/ ctx[0]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(div2, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div0, null);
    				}
    			}

    			if (/*record*/ ctx[1]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.m(div1, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block0) if_block0.d();
    			if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CurrentInfo', slots, []);
    	let { monthLabel = '' } = $$props;
    	let { record = null } = $$props;
    	const writable_props = ['monthLabel', 'record'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CurrentInfo> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('monthLabel' in $$props) $$invalidate(0, monthLabel = $$props.monthLabel);
    		if ('record' in $$props) $$invalidate(1, record = $$props.record);
    	};

    	$$self.$capture_state = () => ({ monthLabel, record });

    	$$self.$inject_state = $$props => {
    		if ('monthLabel' in $$props) $$invalidate(0, monthLabel = $$props.monthLabel);
    		if ('record' in $$props) $$invalidate(1, record = $$props.record);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [monthLabel, record];
    }

    class CurrentInfo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { monthLabel: 0, record: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CurrentInfo",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get monthLabel() {
    		throw new Error("<CurrentInfo>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set monthLabel(value) {
    		throw new Error("<CurrentInfo>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get record() {
    		throw new Error("<CurrentInfo>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set record(value) {
    		throw new Error("<CurrentInfo>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	child_ctx[13] = i;
    	return child_ctx;
    }

    // (214:2) {:else}
    function create_else_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Loading data…";
    			attr_dev(p, "class", "svelte-1cd9x1h");
    			add_location(p, file, 214, 3, 7260);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(214:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (160:2) {#if entries.length}
    function create_if_block(ctx) {
    	let div6;
    	let div0;
    	let scrolly;
    	let updating_value;
    	let t0;
    	let div5;
    	let h2;
    	let t2;
    	let div1;
    	let button0;
    	let t3;
    	let button0_aria_pressed_value;
    	let t4;
    	let span;
    	let t6;
    	let button1;
    	let t7;
    	let button1_aria_pressed_value;
    	let t8;
    	let div2;
    	let t9_value = (/*currentEntry*/ ctx[4]?.label ?? 'Dec 2013') + "";
    	let t9;
    	let t10;
    	let div4;
    	let div3;
    	let radialwaterfall;
    	let t11;
    	let currentinfo;
    	let current;
    	let mounted;
    	let dispose;

    	function scrolly_value_binding(value) {
    		/*scrolly_value_binding*/ ctx[5](value);
    	}

    	let scrolly_props = {
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	if (/*step*/ ctx[1] !== void 0) {
    		scrolly_props.value = /*step*/ ctx[1];
    	}

    	scrolly = new Scrolly({ props: scrolly_props, $$inline: true });
    	binding_callbacks.push(() => bind(scrolly, 'value', scrolly_value_binding));

    	radialwaterfall = new RadialWaterfall({
    			props: {
    				entries: /*entries*/ ctx[2],
    				step: /*step*/ ctx[1] ?? 0,
    				gender: /*gender*/ ctx[0]
    			},
    			$$inline: true
    		});

    	currentinfo = new CurrentInfo({
    			props: {
    				monthLabel: /*currentEntry*/ ctx[4]?.label,
    				record: /*currentRec*/ ctx[3]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div0 = element("div");
    			create_component(scrolly.$$.fragment);
    			t0 = space();
    			div5 = element("div");
    			h2 = element("h2");
    			h2.textContent = "World Record Progression";
    			t2 = space();
    			div1 = element("div");
    			button0 = element("button");
    			t3 = text$1("Men");
    			t4 = space();
    			span = element("span");
    			span.textContent = "|";
    			t6 = space();
    			button1 = element("button");
    			t7 = text$1("Women");
    			t8 = space();
    			div2 = element("div");
    			t9 = text$1(t9_value);
    			t10 = space();
    			div4 = element("div");
    			div3 = element("div");
    			create_component(radialwaterfall.$$.fragment);
    			t11 = space();
    			create_component(currentinfo.$$.fragment);
    			attr_dev(div0, "class", "steps-container svelte-1cd9x1h");
    			add_location(div0, file, 161, 4, 5772);
    			attr_dev(h2, "id", "record-progression");
    			attr_dev(h2, "class", "svelte-1cd9x1h");
    			add_location(h2, file, 178, 5, 6387);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "aria-pressed", button0_aria_pressed_value = /*gender*/ ctx[0] === 'men');
    			attr_dev(button0, "class", "svelte-1cd9x1h");
    			add_location(button0, file, 180, 6, 6524);
    			attr_dev(span, "class", "svelte-1cd9x1h");
    			add_location(span, file, 187, 6, 6672);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "aria-pressed", button1_aria_pressed_value = /*gender*/ ctx[0] === 'women');
    			attr_dev(button1, "class", "svelte-1cd9x1h");
    			add_location(button1, file, 188, 6, 6693);
    			attr_dev(div1, "role", "group");
    			attr_dev(div1, "aria-label", "Select gender");
    			attr_dev(div1, "class", "gender-toggle svelte-1cd9x1h");
    			add_location(div1, file, 179, 5, 6450);
    			attr_dev(div2, "class", "month-label svelte-1cd9x1h");
    			add_location(div2, file, 196, 5, 6859);
    			attr_dev(div3, "class", "plot-clip svelte-1cd9x1h");
    			add_location(div3, file, 200, 6, 6976);
    			attr_dev(div4, "class", "radial-plot svelte-1cd9x1h");
    			add_location(div4, file, 199, 5, 6944);
    			attr_dev(div5, "class", "plot-container svelte-1cd9x1h");
    			add_location(div5, file, 177, 4, 6353);
    			attr_dev(div6, "class", "scrolly-plot-wrapper svelte-1cd9x1h");
    			add_location(div6, file, 160, 3, 5733);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div0);
    			mount_component(scrolly, div0, null);
    			append_dev(div6, t0);
    			append_dev(div6, div5);
    			append_dev(div5, h2);
    			append_dev(div5, t2);
    			append_dev(div5, div1);
    			append_dev(div1, button0);
    			append_dev(button0, t3);
    			append_dev(div1, t4);
    			append_dev(div1, span);
    			append_dev(div1, t6);
    			append_dev(div1, button1);
    			append_dev(button1, t7);
    			append_dev(div5, t8);
    			append_dev(div5, div2);
    			append_dev(div2, t9);
    			append_dev(div5, t10);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			mount_component(radialwaterfall, div3, null);
    			append_dev(div5, t11);
    			mount_component(currentinfo, div5, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[6], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[7], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const scrolly_changes = {};

    			if (dirty & /*$$scope, entries, step, gender*/ 16391) {
    				scrolly_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_value && dirty & /*step*/ 2) {
    				updating_value = true;
    				scrolly_changes.value = /*step*/ ctx[1];
    				add_flush_callback(() => updating_value = false);
    			}

    			scrolly.$set(scrolly_changes);

    			if (!current || dirty & /*gender*/ 1 && button0_aria_pressed_value !== (button0_aria_pressed_value = /*gender*/ ctx[0] === 'men')) {
    				attr_dev(button0, "aria-pressed", button0_aria_pressed_value);
    			}

    			if (!current || dirty & /*gender*/ 1 && button1_aria_pressed_value !== (button1_aria_pressed_value = /*gender*/ ctx[0] === 'women')) {
    				attr_dev(button1, "aria-pressed", button1_aria_pressed_value);
    			}

    			if ((!current || dirty & /*currentEntry*/ 16) && t9_value !== (t9_value = (/*currentEntry*/ ctx[4]?.label ?? 'Dec 2013') + "")) set_data_dev(t9, t9_value);
    			const radialwaterfall_changes = {};
    			if (dirty & /*entries*/ 4) radialwaterfall_changes.entries = /*entries*/ ctx[2];
    			if (dirty & /*step*/ 2) radialwaterfall_changes.step = /*step*/ ctx[1] ?? 0;
    			if (dirty & /*gender*/ 1) radialwaterfall_changes.gender = /*gender*/ ctx[0];
    			radialwaterfall.$set(radialwaterfall_changes);
    			const currentinfo_changes = {};
    			if (dirty & /*currentEntry*/ 16) currentinfo_changes.monthLabel = /*currentEntry*/ ctx[4]?.label;
    			if (dirty & /*currentRec*/ 8) currentinfo_changes.record = /*currentRec*/ ctx[3];
    			currentinfo.$set(currentinfo_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(scrolly.$$.fragment, local);
    			transition_in(radialwaterfall.$$.fragment, local);
    			transition_in(currentinfo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(scrolly.$$.fragment, local);
    			transition_out(radialwaterfall.$$.fragment, local);
    			transition_out(currentinfo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			destroy_component(scrolly);
    			destroy_component(radialwaterfall);
    			destroy_component(currentinfo);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(160:2) {#if entries.length}",
    		ctx
    	});

    	return block;
    }

    // (166:8) {#if (gender === 'men' ? e.menAnnotation : e.womenAnnotation)}
    function create_if_block_1(ctx) {
    	let div;

    	let t_value = (/*gender*/ ctx[0] === 'men'
    	? /*e*/ ctx[11].menAnnotation
    	: /*e*/ ctx[11].womenAnnotation) + "";

    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text$1(t_value);
    			attr_dev(div, "class", "step-content svelte-1cd9x1h");
    			add_location(div, file, 166, 9, 6075);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*gender, entries*/ 5 && t_value !== (t_value = (/*gender*/ ctx[0] === 'men'
    			? /*e*/ ctx[11].menAnnotation
    			: /*e*/ ctx[11].womenAnnotation) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(166:8) {#if (gender === 'men' ? e.menAnnotation : e.womenAnnotation)}",
    		ctx
    	});

    	return block;
    }

    // (164:6) {#each entries as e, i}
    function create_each_block(ctx) {
    	let div;

    	let if_block = (/*gender*/ ctx[0] === 'men'
    	? /*e*/ ctx[11].menAnnotation
    	: /*e*/ ctx[11].womenAnnotation) && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div, "class", "step svelte-1cd9x1h");
    			toggle_class(div, "active", /*step*/ ctx[1] === /*i*/ ctx[13]);

    			toggle_class(div, "has-annotation", /*gender*/ ctx[0] === 'men'
    			? /*e*/ ctx[11].menAnnotation
    			: /*e*/ ctx[11].womenAnnotation);

    			add_location(div, file, 164, 7, 5872);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (/*gender*/ ctx[0] === 'men'
    			? /*e*/ ctx[11].menAnnotation
    			: /*e*/ ctx[11].womenAnnotation) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*step*/ 2) {
    				toggle_class(div, "active", /*step*/ ctx[1] === /*i*/ ctx[13]);
    			}

    			if (dirty & /*gender, entries*/ 5) {
    				toggle_class(div, "has-annotation", /*gender*/ ctx[0] === 'men'
    				? /*e*/ ctx[11].menAnnotation
    				: /*e*/ ctx[11].womenAnnotation);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(164:6) {#each entries as e, i}",
    		ctx
    	});

    	return block;
    }

    // (163:5) <Scrolly bind:value={step}>
    function create_default_slot(ctx) {
    	let t0;
    	let div0;
    	let t1;
    	let div1;
    	let each_value = /*entries*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			div0 = element("div");
    			t1 = space();
    			div1 = element("div");
    			attr_dev(div0, "class", "spacer svelte-1cd9x1h");
    			add_location(div0, file, 172, 6, 6233);
    			attr_dev(div1, "class", "spacer svelte-1cd9x1h");
    			add_location(div1, file, 173, 6, 6262);
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, t0, anchor);
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*step, gender, entries*/ 7) {
    				each_value = /*entries*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t0.parentNode, t0);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(163:5) <Scrolly bind:value={step}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let section0;
    	let div0;
    	let h1;
    	let t1;
    	let h20;
    	let t3;
    	let section1;
    	let h21;
    	let t5;
    	let p0;
    	let t6;
    	let br0;
    	let br1;
    	let br2;
    	let t7;
    	let br3;
    	let br4;
    	let br5;
    	let t8;
    	let br6;
    	let br7;
    	let br8;
    	let t9;
    	let t10;
    	let section2;
    	let div1;
    	let t11;
    	let div3;
    	let h22;
    	let t13;
    	let div2;
    	let p1;
    	let t14;
    	let br9;
    	let br10;
    	let br11;
    	let br12;
    	let t15;
    	let b0;
    	let t17;
    	let b1;
    	let t19;
    	let br13;
    	let br14;
    	let br15;
    	let br16;
    	let t20;
    	let br17;
    	let br18;
    	let br19;
    	let br20;
    	let t21;
    	let i;
    	let t23;
    	let br21;
    	let br22;
    	let br23;
    	let br24;
    	let t24;
    	let br25;
    	let br26;
    	let br27;
    	let br28;
    	let t25;
    	let t26;
    	let section3;
    	let current_block_type_index;
    	let if_block;
    	let t27;
    	let div4;
    	let t28;
    	let section4;
    	let div5;
    	let h23;
    	let t30;
    	let h3;
    	let t32;
    	let div6;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*entries*/ ctx[2].length) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			section0 = element("section");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Reaching New Heights";
    			t1 = space();
    			h20 = element("h2");
    			h20.textContent = "The evolution of kitesurfing jump records";
    			t3 = space();
    			section1 = element("section");
    			h21 = element("h2");
    			h21.textContent = "Riding the Wind";
    			t5 = space();
    			p0 = element("p");
    			t6 = text$1("Kitesurfing is an incredible sport. The fundamental principle is similar to \n\t\t\tmost wind-driven sports: the wind can be exploited for movement. You steer the vessel \n\t\t\tand 'sail' in a particular direction, and the power caught by your sail, combined with your \n\t\t\trudder, propels you in the right direction. If you get the angles right, you can even use this \n\t\t\tprinciple to move upwind.\n\t\t\t");
    			br0 = element("br");
    			br1 = element("br");
    			br2 = element("br");
    			t7 = text$1("\n\t\t\tWith upwind movement, the ocean is your oyster. Provided there is wind...\n\t\t\t");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			t8 = text$1("\n\t\t\tWhen sailing or windsurfing, your sail is largely confined to rotate about your mast, giving you \n\t\t\tall the movement you might need; upwind, downwind, cross-wind... You name it - but this movement is \n\t\t\tconfined to the surface of the sea, a two dimensional plane.\n\t\t\t");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			t9 = text$1("\n\t\t\tKitesurfing introduces access to a third dimension. With the kite high in the sky, the propelling \n\t\t\tforce is vertical, generating lift and taking flight, with kitesurfers riding the wind to ever increasing, \n\t\t\tand unimaginable heights.");
    			t10 = space();
    			section2 = element("section");
    			div1 = element("div");
    			t11 = space();
    			div3 = element("div");
    			h22 = element("h2");
    			h22.textContent = "Unimaginable Heights";
    			t13 = space();
    			div2 = element("div");
    			p1 = element("p");
    			t14 = text$1("Picture yourself on the upper level of a 2-storey house, looking out the window - a height \n\t\t\t\t\tmost of us instinctively understand.\n\t\t\t\t\t");
    			br9 = element("br");
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			t15 = text$1("\n\t\t\t\t\tNow, if that already feels a little lofty, stretch your imagination to the rooftop of a 12-storey building. \n\t\t\t\t\tThink typical city-centre, mid-rise apartment block, and you're in the right ball-park. Gazing out,\n\t\t\t\t\talmost ");
    			b0 = element("b");
    			b0.textContent = "40 meters";
    			t17 = text$1(" (or ");
    			b1 = element("b");
    			b1.textContent = "130 feet";
    			t19 = text$1("), above the ground.\n\t\t\t\t\t");
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			t20 = text$1("\n\t\t\t\t\tReally picture it - at that kind of height, someone's head would be far smaller than the nail on your pinky finger, held out at arms length.\n\t\t\t\t\t");
    			br17 = element("br");
    			br18 = element("br");
    			br19 = element("br");
    			br20 = element("br");
    			t21 = text$1("\n\t\t\t\t\tA little ");
    			i = element("i");
    			i.textContent = "spine-chilling";
    			t23 = text$1(", no?\n\t\t\t\t\t");
    			br21 = element("br");
    			br22 = element("br");
    			br23 = element("br");
    			br24 = element("br");
    			t24 = text$1("\n\t\t\t\t\tThat's the kind of scale elite kitesurfers reach these days, launching themselves skywards\n\t\t\t\t\tfrom the sea, up and over 12-storeys, and back down to safety. Over, and over again.\n\t\t\t\t\t");
    			br25 = element("br");
    			br26 = element("br");
    			br27 = element("br");
    			br28 = element("br");
    			t25 = text$1("\n\t\t\t\t\tHow did we get to such unimaginable heights?");
    			t26 = space();
    			section3 = element("section");
    			if_block.c();
    			t27 = space();
    			div4 = element("div");
    			t28 = space();
    			section4 = element("section");
    			div5 = element("div");
    			h23 = element("h2");
    			h23.textContent = "Coming soon…";
    			t30 = space();
    			h3 = element("h3");
    			h3.textContent = "The who’s and how’s setting these records.";
    			t32 = space();
    			div6 = element("div");
    			attr_dev(h1, "class", "title-main svelte-1cd9x1h");
    			add_location(h1, file, 110, 3, 3079);
    			attr_dev(h20, "class", "title-sub svelte-1cd9x1h");
    			add_location(h20, file, 111, 3, 3131);
    			attr_dev(div0, "class", "hero-content svelte-1cd9x1h");
    			add_location(div0, file, 109, 2, 3049);
    			attr_dev(section0, "class", "hero-wrapper svelte-1cd9x1h");
    			add_location(section0, file, 108, 1, 3016);
    			attr_dev(h21, "class", "svelte-1cd9x1h");
    			add_location(h21, file, 115, 2, 3282);
    			attr_dev(br0, "class", "svelte-1cd9x1h");
    			add_location(br0, file, 121, 3, 3725);
    			attr_dev(br1, "class", "svelte-1cd9x1h");
    			add_location(br1, file, 121, 7, 3729);
    			attr_dev(br2, "class", "svelte-1cd9x1h");
    			add_location(br2, file, 121, 11, 3733);
    			attr_dev(br3, "class", "svelte-1cd9x1h");
    			add_location(br3, file, 123, 3, 3818);
    			attr_dev(br4, "class", "svelte-1cd9x1h");
    			add_location(br4, file, 123, 7, 3822);
    			attr_dev(br5, "class", "svelte-1cd9x1h");
    			add_location(br5, file, 123, 11, 3826);
    			attr_dev(br6, "class", "svelte-1cd9x1h");
    			add_location(br6, file, 127, 3, 4103);
    			attr_dev(br7, "class", "svelte-1cd9x1h");
    			add_location(br7, file, 127, 7, 4107);
    			attr_dev(br8, "class", "svelte-1cd9x1h");
    			add_location(br8, file, 127, 11, 4111);
    			attr_dev(p0, "class", "intro-text svelte-1cd9x1h");
    			add_location(p0, file, 116, 2, 3309);
    			attr_dev(section1, "class", "intro-section svelte-1cd9x1h");
    			attr_dev(section1, "aria-label", "Introduction");
    			add_location(section1, file, 114, 1, 3222);
    			attr_dev(div1, "class", "height-intro-background svelte-1cd9x1h");
    			add_location(div1, file, 134, 2, 4453);
    			attr_dev(h22, "class", "height-intro-title svelte-1cd9x1h");
    			add_location(h22, file, 136, 3, 4537);
    			attr_dev(br9, "class", "svelte-1cd9x1h");
    			add_location(br9, file, 141, 5, 4800);
    			attr_dev(br10, "class", "svelte-1cd9x1h");
    			add_location(br10, file, 141, 9, 4804);
    			attr_dev(br11, "class", "svelte-1cd9x1h");
    			add_location(br11, file, 141, 13, 4808);
    			attr_dev(br12, "class", "svelte-1cd9x1h");
    			add_location(br12, file, 141, 17, 4812);
    			attr_dev(b0, "class", "svelte-1cd9x1h");
    			add_location(b0, file, 144, 12, 5048);
    			attr_dev(b1, "class", "svelte-1cd9x1h");
    			add_location(b1, file, 144, 33, 5069);
    			attr_dev(br13, "class", "svelte-1cd9x1h");
    			add_location(br13, file, 145, 5, 5110);
    			attr_dev(br14, "class", "svelte-1cd9x1h");
    			add_location(br14, file, 145, 9, 5114);
    			attr_dev(br15, "class", "svelte-1cd9x1h");
    			add_location(br15, file, 145, 13, 5118);
    			attr_dev(br16, "class", "svelte-1cd9x1h");
    			add_location(br16, file, 145, 17, 5122);
    			attr_dev(br17, "class", "svelte-1cd9x1h");
    			add_location(br17, file, 147, 5, 5278);
    			attr_dev(br18, "class", "svelte-1cd9x1h");
    			add_location(br18, file, 147, 9, 5282);
    			attr_dev(br19, "class", "svelte-1cd9x1h");
    			add_location(br19, file, 147, 13, 5286);
    			attr_dev(br20, "class", "svelte-1cd9x1h");
    			add_location(br20, file, 147, 17, 5290);
    			attr_dev(i, "class", "svelte-1cd9x1h");
    			add_location(i, file, 148, 14, 5309);
    			attr_dev(br21, "class", "svelte-1cd9x1h");
    			add_location(br21, file, 149, 5, 5341);
    			attr_dev(br22, "class", "svelte-1cd9x1h");
    			add_location(br22, file, 149, 9, 5345);
    			attr_dev(br23, "class", "svelte-1cd9x1h");
    			add_location(br23, file, 149, 13, 5349);
    			attr_dev(br24, "class", "svelte-1cd9x1h");
    			add_location(br24, file, 149, 17, 5353);
    			attr_dev(br25, "class", "svelte-1cd9x1h");
    			add_location(br25, file, 152, 5, 5549);
    			attr_dev(br26, "class", "svelte-1cd9x1h");
    			add_location(br26, file, 152, 9, 5553);
    			attr_dev(br27, "class", "svelte-1cd9x1h");
    			add_location(br27, file, 152, 13, 5557);
    			attr_dev(br28, "class", "svelte-1cd9x1h");
    			add_location(br28, file, 152, 17, 5561);
    			attr_dev(p1, "class", "intro-text svelte-1cd9x1h");
    			add_location(p1, file, 138, 4, 4633);
    			attr_dev(div2, "class", "height-intro-text svelte-1cd9x1h");
    			add_location(div2, file, 137, 3, 4597);
    			attr_dev(div3, "class", "height-intro-content svelte-1cd9x1h");
    			add_location(div3, file, 135, 2, 4499);
    			attr_dev(section2, "class", "height-intro-section svelte-1cd9x1h");
    			attr_dev(section2, "aria-label", "Unimaginable Heights");
    			add_location(section2, file, 133, 1, 4378);
    			attr_dev(section3, "aria-labelledby", "record-progression");
    			attr_dev(section3, "class", "svelte-1cd9x1h");
    			add_location(section3, file, 158, 1, 5660);
    			attr_dev(div4, "class", "spacer svelte-1cd9x1h");
    			add_location(div4, file, 218, 1, 7303);
    			attr_dev(h23, "class", "svelte-1cd9x1h");
    			add_location(h23, file, 221, 3, 7435);
    			attr_dev(h3, "class", "svelte-1cd9x1h");
    			add_location(h3, file, 222, 3, 7460);
    			attr_dev(div5, "class", "coming-soon-content svelte-1cd9x1h");
    			add_location(div5, file, 220, 2, 7398);
    			attr_dev(section4, "class", "coming-soon-section svelte-1cd9x1h");
    			attr_dev(section4, "aria-label", "Upcoming Profiles");
    			add_location(section4, file, 219, 1, 7327);
    			attr_dev(div6, "class", "spacer svelte-1cd9x1h");
    			add_location(div6, file, 225, 1, 7534);
    			attr_dev(main, "class", "svelte-1cd9x1h");
    			add_location(main, file, 107, 0, 3008);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, section0);
    			append_dev(section0, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t1);
    			append_dev(div0, h20);
    			append_dev(main, t3);
    			append_dev(main, section1);
    			append_dev(section1, h21);
    			append_dev(section1, t5);
    			append_dev(section1, p0);
    			append_dev(p0, t6);
    			append_dev(p0, br0);
    			append_dev(p0, br1);
    			append_dev(p0, br2);
    			append_dev(p0, t7);
    			append_dev(p0, br3);
    			append_dev(p0, br4);
    			append_dev(p0, br5);
    			append_dev(p0, t8);
    			append_dev(p0, br6);
    			append_dev(p0, br7);
    			append_dev(p0, br8);
    			append_dev(p0, t9);
    			append_dev(main, t10);
    			append_dev(main, section2);
    			append_dev(section2, div1);
    			append_dev(section2, t11);
    			append_dev(section2, div3);
    			append_dev(div3, h22);
    			append_dev(div3, t13);
    			append_dev(div3, div2);
    			append_dev(div2, p1);
    			append_dev(p1, t14);
    			append_dev(p1, br9);
    			append_dev(p1, br10);
    			append_dev(p1, br11);
    			append_dev(p1, br12);
    			append_dev(p1, t15);
    			append_dev(p1, b0);
    			append_dev(p1, t17);
    			append_dev(p1, b1);
    			append_dev(p1, t19);
    			append_dev(p1, br13);
    			append_dev(p1, br14);
    			append_dev(p1, br15);
    			append_dev(p1, br16);
    			append_dev(p1, t20);
    			append_dev(p1, br17);
    			append_dev(p1, br18);
    			append_dev(p1, br19);
    			append_dev(p1, br20);
    			append_dev(p1, t21);
    			append_dev(p1, i);
    			append_dev(p1, t23);
    			append_dev(p1, br21);
    			append_dev(p1, br22);
    			append_dev(p1, br23);
    			append_dev(p1, br24);
    			append_dev(p1, t24);
    			append_dev(p1, br25);
    			append_dev(p1, br26);
    			append_dev(p1, br27);
    			append_dev(p1, br28);
    			append_dev(p1, t25);
    			append_dev(main, t26);
    			append_dev(main, section3);
    			if_blocks[current_block_type_index].m(section3, null);
    			append_dev(main, t27);
    			append_dev(main, div4);
    			append_dev(main, t28);
    			append_dev(main, section4);
    			append_dev(section4, div5);
    			append_dev(div5, h23);
    			append_dev(div5, t30);
    			append_dev(div5, h3);
    			append_dev(main, t32);
    			append_dev(main, div6);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(section3, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let currentEntry;
    	let currentRec;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let gender = 'men';
    	let step = 0;

    	// let currentEntry = [];
    	// let currentRec = [];
    	// Parsing and storing data
    	let raw = [];

    	onMount(async () => {
    		raw = await csv('data/records.csv', row => ({
    			date: timeParse('%m/%d/%y')(row.Date_US),
    			name: row.Name,
    			height: +row.Height_m,
    			gender: row.Gender,
    			kiteBrand: row.kite_brand || 'null',
    			kiteModel: row.kite_model || 'null',
    			kiteSize: +row.kite_size || 'null',
    			country: row.loaction_country || 'null',
    			location: row.location || 'null',
    			annotation: 'null'
    		}));

    		console.log(raw);
    		buildEntries();
    		console.log(entries);
    	});

    	const fmtMonth = timeFormat('%b %Y');
    	let entries = [];

    	function buildEntries() {
    		raw.sort((a, b) => a.date - b.date);
    		const [start, end] = [raw[0].date, raw.at(-1).date];
    		const months = timeMonths(new Date(start.getFullYear(), start.getMonth(), 1), new Date(end.getFullYear(), end.getMonth() + 1, 1));
    		let lastMenH = 0;
    		let lastWomenH = 0;

    		$$invalidate(2, entries = months.map(date => {
    			// find the raw record object for this month (if any)
    			const menRec = raw.find(r => r.gender === 'male' && r.date.getFullYear() === date.getFullYear() && r.date.getMonth() === date.getMonth());

    			const womenRec = raw.find(r => r.gender === 'female' && r.date.getFullYear() === date.getFullYear() && r.date.getMonth() === date.getMonth());
    			const menH = menRec ? menRec.height : lastMenH;
    			const womenH = womenRec ? womenRec.height : lastWomenH;
    			const menPrev = lastMenH;
    			const womenPrev = lastWomenH;
    			if (menRec && menH > lastMenH) lastMenH = menH;
    			if (womenRec && womenH > lastWomenH) lastWomenH = womenH;

    			// get annotations
    			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    			const { men = '', women = '' } = annotationMap[key] || {};
    			console.log(key, annotationMap[key]);

    			return {
    				date,
    				label: fmtMonth(date),
    				menH,
    				menPrev,
    				womenH,
    				womenPrev,
    				// *** carry the whole record object ***
    				menRec,
    				womenRec,
    				// annotations or other fields you like
    				menAnnotation: men,
    				womenAnnotation: women
    			};
    		}));
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function scrolly_value_binding(value) {
    		step = value;
    		$$invalidate(1, step);
    	}

    	const click_handler = () => $$invalidate(0, gender = 'men');
    	const click_handler_1 = () => $$invalidate(0, gender = 'women');

    	$$self.$capture_state = () => ({
    		onMount,
    		csv,
    		timeParse,
    		timeFormat,
    		timeMonths,
    		RadialWaterfall,
    		Scrolly,
    		annotationMap,
    		CurrentInfo,
    		gender,
    		step,
    		raw,
    		fmtMonth,
    		entries,
    		buildEntries,
    		currentRec,
    		currentEntry
    	});

    	$$self.$inject_state = $$props => {
    		if ('gender' in $$props) $$invalidate(0, gender = $$props.gender);
    		if ('step' in $$props) $$invalidate(1, step = $$props.step);
    		if ('raw' in $$props) raw = $$props.raw;
    		if ('entries' in $$props) $$invalidate(2, entries = $$props.entries);
    		if ('currentRec' in $$props) $$invalidate(3, currentRec = $$props.currentRec);
    		if ('currentEntry' in $$props) $$invalidate(4, currentEntry = $$props.currentEntry);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*entries, step*/ 6) {
    			$$invalidate(4, currentEntry = entries[step] || null);
    		}

    		if ($$self.$$.dirty & /*entries, step, gender*/ 7) {
    			$$invalidate(3, currentRec = entries.slice(0, step + 1).reverse().find(e => e[gender + 'Rec'])?.[gender + 'Rec'] || null); // take all up to and including the current step
    			// search backwards
    			// find first entry that has a record
    		}
    	};

    	return [
    		gender,
    		step,
    		entries,
    		currentRec,
    		currentEntry,
    		scrolly_value_binding,
    		click_handler,
    		click_handler_1
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
