require "test_helper"

class Admin::FinalityControllerTest < ActionDispatch::IntegrationTest
  setup do
    Flipper.enable(Finality::FEATURE_FLAG)

    @admin = create_user(slack_id: "U_FINALITY_ADMIN", display_name: "finality_admin")
    @admin.grant_role!(:admin)
    @owner = create_user(slack_id: "U_FINALITY_OWNER", display_name: "finality_owner")

    project = Project.create!(title: "Finality page project")
    Project::Membership.create!(project: project, user: @owner, role: :owner)
    @ship_event = Post::ShipEvent.create!(body: "Ship it", uploading_attachments: true, certification_status: "approved")
    shipped_at = Time.utc(2026, 10, 27, 16)
    Post.create!(project: project, user: @owner, postable: @ship_event, created_at: shipped_at, updated_at: shipped_at)
    @ship_event.update_columns(payout: 100)
  end

  teardown do
    Flipper.disable(Finality::FEATURE_FLAG)
  end

  test "admin sees every ship in the window" do
    sign_in @admin

    get admin_finality_path

    assert_response :success
    assert_select "td", text: "Finality page project"
  end

  test "admin can award missing bonuses, and the run is audited" do
    sign_in @admin

    assert_difference -> { @owner.ledger_entries.where(created_by: Finality::BONUS_CREATED_BY).count }, 1 do
      assert_difference -> { PaperTrail::Version.where(event: "finality_bonus_award").count }, 1 do
        post award_admin_finality_path
      end
    end

    assert_redirected_to admin_finality_path
    assert_equal 8, Finality.bonus_entry(@ship_event.reload).amount
  end

  test "non-admins cannot open the page" do
    sign_in @owner

    get admin_finality_path

    assert_response :not_found
  end
end
