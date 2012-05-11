
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('islamic-datetime');
const _ = Gettext.gettext;
const N_ = function(e) { return e };

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const METHODS = {
    1: { name: N_("Egyptian General Authority of Survey") },
    2: { name: N_("University of Islamic Sciences, Karachi (Shaf\'i)") },
    3: { name: N_("University of Islamic Sciences, Karachi (Hanafi)") },
    4: { name: N_("Islamic Society of North America") },
    5: { name: N_("Muslim World League") },
    6: { name: N_("Umm Al-Qurra") },
    7: { name: N_("Fixed Ishaa Interval (always 90)") },
    8: { name: N_("Egyptian General Authority of Survey (Egypt)") }
};

const IslamicDatetimeWidget = new GObject.Class({
    Name: 'IslamicDatetime.Prefs.IslamicDatetimeWidget',
    GTypeName: 'IslamicDatetimeWidget',
    Extends: Gtk.Grid,

    _init : function(params) {
        this.parent(params);
/*        this.column_spacing = 10;
        this.margin = 10;*/

        let ypos=0;

        this._settings = Convenience.getSettings();

        /***  Location   ***/
        this._add_double(0, 'longitude', _("Longitude"),
                         _("Set the locations latitude"), -90.0, 90.0, 0.01, false);
        this._add_double(1, 'latitude', _("Latitude"),
                         _("Set the locations timezone"), -180.0, 180.0, 0.01, false);

        this._add_double(2, 'gmt-diff', _("Time zone"),
                         _("Set the locations timezone"), -12.0, 14.0, 0.5,
                         true);
        this._add_bool(3, 'dst', _("DST"), _("Enable DST"));

        /***  Method   ***/
        this._add_enum(4, 'method', _("Calculation method"), METHODS,
                       _("Choose the prayer time calculation method"));

        this._add_filechooser(5, 'azan-file', _("Azan audio file"),
                              _("Audio file to play azan"));
        this._add_int(6, 'hijri-fix', _("Hijri date correction"),
                      _("Manual correction for Hijri date calculation"), -2, 2,
                      1, true);
    },

    _add_tooltip: function(Widget, Text) {
      Widget.set_has_tooltip(true);
      Widget.connect('query-tooltip',
                     Lang.bind(this, function(Widget, x, y, keymode, f) {
                      f.set_text(Text);
                      return true;
                     }));
    },

    _add_label: function(ypos, Label, Tooltip) {
      let label = new Gtk.Label({ label: Label });
      this._add_tooltip(label, Tooltip);
      this.attach(label, 0, ypos, 1, 1);
    },

    _add_int: function(ypos, Key, Label, Tooltip, min, max, step, snap) {
      this._add_label(ypos, Label, Tooltip);
      let value = this._settings.get_int(Key);
      let entry;
      if(typeof min !== 'undefined') {
        entry = Gtk.SpinButton.new_with_range(min, max, step);
        entry.set_snap_to_ticks(snap);
        entry.set_value(String(value));
        entry.connect('value-changed', Lang.bind(this, function(widget, evnt) {
              this._settings.set_int(Key, widget.get_value());
            }));
      }
      else {
        entry = new Gtk.Entry();
        entry.set_text(String(value));
        entry.connect('activate', Lang.bind(this, function(widget, evnt) {
              this._settings.set_int(Key, widget.get_text());
            }));
        entry.connect('focus-out-event', Lang.bind(this, function(widget) {
              this._settings.set_int(Key, entry.get_text());
            }));
      }
      this._add_tooltip(entry, Tooltip);
      this.attach(entry, 1, ypos, 1, 1);
    },

    _add_double: function(ypos, Key, Label, Tooltip, min, max, step, snap) {
      this._add_label(ypos, Label, Tooltip);
      let value = this._settings.get_double(Key);
      let entry;
      if(typeof min !== 'undefined') {
        entry = Gtk.SpinButton.new_with_range(min, max, step);
        entry.set_snap_to_ticks(snap);
        entry.set_value(String(value));
        entry.connect('value-changed', Lang.bind(this, function(widget, evnt) {
              this._settings.set_double(Key, widget.get_value());
            }));
      }
      else {
        entry = new Gtk.Entry();
        entry.set_text(String(value));
        entry.connect('activate', Lang.bind(this, function(widget, evnt) {
              this._settings.set_double(Key, widget.get_text());
            }));
        entry.connect('focus-out-event', Lang.bind(this, function(widget) {
              this._settings.set_double(Key, entry.get_text());
            }));
      }
      this._add_tooltip(entry, Tooltip);
      this.attach(entry, 1, ypos, 1, 1);
    },

    _add_enum: function(ypos, Key, Label, Items, Tooltip) {
      this._add_label(ypos, Label, Tooltip);
      let combo = new Gtk.ComboBoxText();
      let currentValue = this._settings.get_enum(Key);
      for (let item in Items) {
          let obj = Items[item];
          let name = Gettext.gettext(obj.name);
          combo.append_text(name);
      }
      combo.connect('changed', Lang.bind(this, function(widget) {
        this._settings.set_enum(Key, combo.get_active()+1);
      }));
      combo.set_active(currentValue-1);
      this._add_tooltip(combo, Tooltip);
      this.attach(combo, 1, ypos, 1, 1);
    },

    _add_bool: function(ypos, Key, Label, Tooltip) {
      this._add_label(ypos, Label, Tooltip);
      let check = new Gtk.CheckButton();
      let currentValue = this._settings.get_boolean(Key);
      check.set_active(currentValue);
      check.connect('toggled', Lang.bind(this, function(widget) {
        this._settings.set_boolean(Key, check.get_active());
      }));
      this._add_tooltip(check, Tooltip);
      this.attach(check, 1, ypos, 1, 1);
    },

    _add_filechooser: function(ypos, Key, Label, Tooltip) {
      this._add_label(ypos, Label, Tooltip);
      let fname = this._settings.get_string(Key);
      let entry = new Gtk.Entry();
      entry.set_text(fname);
      entry.set_icon_from_stock(Gtk.EntryIconPosition.PRIMARY, Gtk.STOCK_OPEN)

      entry.connect('icon-press', Lang.bind(this, function(widget, pos, evnt) {
        let filechooser = new Gtk.FileChooserDialog({ title: Label, parent: this.window, action: Gtk.FileChooserAction.OPEN });
        filechooser.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        filechooser.add_button(Gtk.STOCK_OK, Gtk.ResponseType.OK);
        let filefilter = new Gtk.FileFilter();
        filefilter.add_mime_type('audio/*');
        filechooser.add_filter(filefilter);
        if (filechooser.run() == Gtk.ResponseType.OK ) {
            entry.set_text(filechooser.get_filename());
            this._settings.set_string(Key, filechooser.get_filename());
        }
        filechooser.destroy();
      }));

      this._add_tooltip(entry, Tooltip);
      this.attach(entry, 1, ypos, 1, 1);
    },

});


function init() {
    Convenience.initTranslations();
}

function buildPrefsWidget() {
    let widget = new IslamicDatetimeWidget();
    widget.show_all();

    return widget;
}
