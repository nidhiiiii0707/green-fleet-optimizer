# AIS processed support files

These CSVs were derived from the uploaded Marine Cadastre AIS data dictionary and
lookup documents. They are LOOKUP/SCHEMA files, not AIS observations.

Files:
- ais_field_dictionary.csv
  Definitions, units/domains, and intended optimization use of AIS fields.
- ais_navigation_status_lookup.csv
  Navigation status code -> description mapping.
- ais_vessel_type_lookup.csv
  Key vessel-type codes -> Marine Cadastre classification.
- ais_required_fields.csv
  Fields to retain when the actual AIS point/track dataset is downloaded.

Recommended retained fields for the SIH prototype:
mmsi, imo, vessel_name, base_date_time, latitude, longitude, sog, cog, heading,
vessel_type, length, width, draft, cargo, status, transceiver, call_sign.

Important:
- These files do NOT contain vessel observations.
- The Marine Cadastre source shown in the uploaded documents is AIS data for
  U.S. waters.
- `cargo` in AIS is a cargo TYPE code, not cargo quantity in tonnes.
- `draft` is in metres and can be used directly once actual AIS records are obtained.
- Vessel-type codes require the lookup table.
- Navigation status codes should be decoded before feasibility filtering.
