SUBDIRS=po

topextensiondir = $(datadir)/gnome-shell/extensions

uuid = islamic-datetime@sabily.org

extensiondir = $(topextensiondir)/$(uuid)

dist_extension_DATA = extension.js stylesheet.css metadata.json convenience.js prefs.js

gsettings_SCHEMAS=schemas/org.gnome.shell.extensions.islamic-datetime.gschema.xml

@GSETTINGS_RULES@

icondir = $(datadir)/icons/hicolor/scalable/apps
icon_DATA = islamic-datetime.svg

zip-file:
	glib-compile-schemas schemas
	zip -qr islamic-datetime.zip $(dist_extension_DATA) $(icon_DATA) schemas/ po/*.po* COPYING
