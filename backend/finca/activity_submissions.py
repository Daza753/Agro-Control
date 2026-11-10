import json

from rest_framework.renderers import JSONRenderer

from finca.models import ActivitySubmission
from finca.serializers import DailyActivitySerializer


def serialize_activity(activity):
    data = json.loads(JSONRenderer().render(DailyActivitySerializer(activity).data))
    data["animal_id"] = str(activity.animal_id) if activity.animal_id else None
    return data


def submission_data(activity, submitted_by):
    data = serialize_activity(activity)
    data["submitted_by"] = {
        "id": str(submitted_by.pk),
        "full_name": submitted_by.full_name,
        "email": submitted_by.email,
        "role": submitted_by.role,
    }
    return data


def record_activity_submission(activity, submitted_by, action):
    data = submission_data(activity, submitted_by)
    return ActivitySubmission.objects.create(
        farm_id=activity.farm_id,
        activity=activity,
        submitted_by=submitted_by,
        action=action,
        data=data,
    )


def record_deleted_activity_submission(activity, submitted_by):
    data = submission_data(activity, submitted_by)
    submission = ActivitySubmission.objects.create(
        farm_id=activity.farm_id,
        activity=None,
        submitted_by=submitted_by,
        action=ActivitySubmission.Action.DELETED,
        data=data,
    )
    return submission
