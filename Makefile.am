SUBDIRS=po

topextensiondir = $(datadir)/gnome-shell/extensions

uuid = islamic-datetime@sabily.org

extensiondir = $(topextensiondir)/$(uuid)

dist_extension_DATA = extension.js stylesheet.css metadata.json convenience.js

gsettings_SCHEMAS=org.gnome.shell.extensions.islamic-datetime.gschema.xml

@GSETTINGS_RULES@

dist_bin_SCRIPTS = islamic-datetime-config

icondir = $(datadir)/icons/hicolor/scalable/apps
icon_DATA = islamic-datetime.svg
