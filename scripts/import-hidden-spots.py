"""Import user-supplied discovery candidates without treating claims as verified."""
import csv
import json
import re
import sys
from pathlib import Path

source = Path(sys.argv[1])
rows = list(csv.DictReader(source.open(encoding="utf-8-sig", newline="")))
spots = {}
duplicates = []
for row in rows:
    name = row['Spot_Name'].strip()
    key = re.sub(r'[^a-z0-9]', '', name.lower())
    if key in spots:
        duplicates.append(name)
        continue
    lat, lng = row['Latitude'].strip(), row['Longitude'].strip()
    coordinates = None
    if lat and lng:
        try:
            a, b = float(lat), float(lng)
            if -90 <= a <= 90 and -180 <= b <= 180:
                coordinates = {'lat': a, 'lng': b}
        except ValueError:
            pass
    description = row['Highlights_and_Why_Visit'].strip()
    spots[key] = {
        'id': re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'),
        'name': name, 'category': row['Category'].strip(),
        'area': row['Location_Area'].strip(),
        'description': description, 'descriptionTruncated': len(row['Highlights_and_Why_Visit']) == 350,
        'coordinates': coordinates, 'verification': 'unverified',
        'reportedDistance': row['Distance_from_Udaipur_km'].strip(),
        'reportedBestTime': row['Best_Time_to_Visit'].strip(),
        'reportedFee': row['Entry_Fee_INR'].strip(),
        'reportedHours': row['Opening_Timings'].strip(),
        'activities': row['Key_Activities'].strip(),
        'directionsNote': row['How_to_Reach'].strip(),
        'sourceNote': row['Sources'].strip(),
        'socialUrl': row['Instagram_Reel_or_Post_URL'].strip(),
    }
output = Path('content/research/udaipur-spots.json')
output.write_text(json.dumps(list(spots.values()), ensure_ascii=False, indent=2) + '\n')
report = {'source': source.name, 'inputRows': len(rows), 'imported': len(spots),
          'duplicatesRemoved': duplicates,
          'withCoordinates': sum(s['coordinates'] is not None for s in spots.values()),
          'truncatedDescriptions': sum(s['descriptionTruncated'] for s in spots.values()),
          'verification': 'No external facts verified. Original reported fields retained as research.'}
Path('docs/data-import/udaipur-spots.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
